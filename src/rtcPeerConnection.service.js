(function(){
  'use strict';

  angular.module('ng-websocket-for-rtc').provider('RTCPeerConnection', RTCPeerConnectionProvider);

  var LISTENER = 0;
  var SPEAKER = 1;

  function RTCPeerConnectionProvider(){
    var me = this;
    var ICEServers = [];
    var type = SPEAKER;

    me.setICEServers = setICEServers;
    me.$get = $get;
    me.setType = setType


    me.LISTENER = LISTENER;
    me.SPEAKER  = SPEAKER;

    function setType(value){
      type = ( value === SPEAKER || value === LISTENER ) ? value : SPEAKER
    }

    function setICEServers(servers){
      ICEServers = servers;
    }

    function $get(){
      var instance = {
        peer : undefined,
        initialize : initialize
      }

      function initialize(webSocketInterface, configs, callbacks){
        configs = configs || { 
          servers : { iceServers : ICEServers },
          socketType : type
        };

        callbacks = callbacks || {};

        instance.peer = new RTCConnectionClient(webSocketInterface, configs, callbacks);
      }
      return instance;
    }
  }


  
  function RTCConnectionClient(webSocketInterface, configs, callbacks){
    var me = this

    me.sendVideo = sendVideo
    me.sendMessage = sendChatMessage
    me.queue = configs.socketType === SPEAKER ? queueAsSpeaker : queueAsListener 

    function queueAsListener(){
      webSocketInterface.serverSend( {type : 'queue_as_listener' } )
    }

    function queueAsSpeaker(){
      webSocketInterface.serverSend( {type : 'queue_as_speaker' } )
    }

    function sendChatMessage(text, id){
      sendChannel.send(JSON.stringify({ type : 'chat' , value : text, id : id }))
    }

    function sendVideo(videoElement, constraints){
      navigator.mediaDevices.getUserMedia(constraints)
        .then(function(stream){
          videoElement.srcObject = stream
          pc.addStream(stream)
          connect()
        })
    }

    function noop(){}

    var pc = new RTCPeerConnection(configs.servers);
    var sendChannel = pc.createDataChannel('sendDataChannel', null)
    var receiveChannel;
    
    pc.ondatachannel = function (event){
      receiveChannel = event.channel;
      receiveChannel.onmessage = onMessage
    }

    function onMessage(messageEvent){
      var data = JSON.parse(messageEvent.data)
      if ( data.type === 'chat' ) {
        callbacks.onMessageReceived(data.value)
      } else if (data.type === 'system') {
        switch(data.value) {
          case 'ack_message_received' : 
            callbacks.onAckMessageReceived(data.id)
            break;
          default : 
            console.log(data)
        }
      }
    }

    pc.onicecandidate = function(event){
      if (event.candidate) sendMessage({'ice':event.candidate})
    } 

    pc.onaddstream = function (event) {
      callbacks.onAddStream(event)
    }

    function readMessage(msg, sender) {
      if (msg.ice != undefined)
        pc.addIceCandidate(new RTCIceCandidate(msg.ice));
      else if ( msg.sdp && msg.sdp.type == "offer")
        pc.setRemoteDescription(new RTCSessionDescription(msg.sdp))
          .then(function() { return pc.createAnswer()})
          .then(function (answer) { return pc.setLocalDescription(answer)})
          .then(function(){ return sendMessage({'sdp': pc.localDescription})});
      else if (msg.sdp && msg.sdp.type == "answer")
        pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
      else {
        console.log('wasnt expecting:', msg)
      }
    }

    webSocketInterface.on_once('channel_webrtc', readMessage)
    webSocketInterface.on_once('ack_message_received', function(){})
    webSocketInterface.on_once('ask_take_call', acceptSpeaker)
    webSocketInterface.on_once('assert_connected_with_pair', connect )

    var sendMessage = webSocketInterface.send

    function acceptSpeaker(){
      webSocketInterface.serverSend( { type : 'accept_speaker' } )
    }

    function connect() {
      pc.createOffer()
      .then(function(offer){
        pc.setLocalDescription(offer)   
        sendMessage({'sdp': pc.localDescription})
      })
    }
  }

})();