/*!
 * See LICENSE in this repository for license information
 */
(function(){
'use strict';

angular
  .module('ng-websocket-for-rtc', ['ngWebSocket']);

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
    webSocketInterface.on_once('ack_message_received', noop )
    webSocketInterface.on_once('ask_take_call', acceptSpeaker )
    webSocketInterface.on_once('assert_connected_with_pair', configs.socketType === SPEAKER ? noop : connect )

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
(function(){
  'use strict';

  angular.module('ng-websocket-for-rtc').provider('WebSocket', WebSocketProvider)

  function WebSocketProvider(){
    var me = this;
    var webSocketUrl = '';
    var generateId = function(){
      return Math.random().toString();
    }


    me.webSocketUrl = function(value){
      webSocketUrl = value;
    }

    me.generateIdStrategy = function(callback){
      generateId = callback;
    }

    me.$get = ['$websocket', function($websocket){
      var client = new WebSocketClient($websocket, webSocketUrl);
      client.connect();
      return client;
    }]

    function WebSocketClient($websocket, url){
      var me = this;
  
      var CONNECTION_CLOSED_ABNORMALLY = 1006;
      
      me.isReady = false;
      me.url = url;
      me.$register = new Register();
      me.$register_once = new SimpleRegister();
      me.on = on;
      me.on_once = on_once;
      me.send = send;
      me.connect = connect;
      me.unregister = unregister;
      me.serverSend = serverSend;
      
      function send(aStructure){
        me.$server.send( JSON.stringify({data : aStructure, type : 'webrtc'}) )
      }
      
      function serverSend(aStructure ){
        me.$server.send( JSON.stringify({data : aStructure, type : 'server'}) )
      }
      
      function noop(a,b){
        // console.log('noop', a) 
      }
      function on(keyword, callback){ 
        return me.$register.register(keyword, callback)
      }
      function on_once(keyword, callback){ 
        return me.$register_once.register(keyword, callback)
      }
      function unregister(id){
        return me.$register.unregister(id)
      }

      function simpleSend(message){ me.$server.send(message) }
      
      function onMessageActionDefault(messageEvent){
        var data = JSON.parse(messageEvent.data)
        return data.keyword ?
          // me.$register[data.keyword] ? 
          me.$register.hasCallback(data.keyword) || me.$register_once.hasCallback(data.keyword) ?
            // me.$register[data.keyword](data.data, data.sender, messageEvent) 
            callOnAllCallbacks(data.keyword, [data.data, data.sender, messageEvent])/*me.$register.callbacks(data.keyword).forEach(function(fx){fx(data.data, data.sender, messageEvent)})*/
          : noop (data, messageEvent)
         : noop(messageEvent)
      }

      function callOnAllCallbacks(keyword, params){
        me.$register.callbacks(keyword).forEach(function(fx){fx.apply(undefined, params)})
        me.$register_once.callbacks(keyword).forEach(function(fx){fx.apply(undefined, params)})
      }

      function callSelfEvent(keyword, event, feed){
        return me.$register.hasCallback(keyword) || me.$register_once.hasCallback(keyword)
            ? callOnAllCallbacks(keyword, [event, feed])/*me.$register.callbacks(data.keyword).forEach(function(fx){fx(data.data, data.sender, messageEvent)})*/
            : noop(event,feed)
        // !!me.$register[keyword] ?  me.$register[keyword](event, feed) : noop(event, feed)
      }
      
      function connect(){
        me.$server = $websocket(url);
        me.$server.onMessage(onMessageActionDefault)
        me.$server.onOpen(function(){
          me.isReady = true
          callSelfEvent('system_on_open', event)
          //setInterval(() => me.serverSend({ type : 'ping' }), 50000)1
        })
        me.$server.onClose(function(event){
          var lastReadyState = me.isReady
          me.isReady = false
          if (event.code == CONNECTION_CLOSED_ABNORMALLY)
            setTimeout(function() { me.connect() }, 1000);
          callSelfEvent('system_on_close', event, { lastReadyState : lastReadyState })
        })
        me.$server.onError(function(event){
          me.isReady = false
        })
        return me
      }
    }

    function Register(){
      var me = this;
      var ids = {}
      var records = {}
      
      me.register = register
      me.callbacks = callbacks
      me.unregister = unregister
      me.hasCallback = hasCallback

      function register(name, callback){
        var id = generateId() 
        var record = records[name]
        if (!!record){
          record[id] = callback
        } else {
          var obj = {}
          obj[id] = callback
          records[name] = obj
        }
        ids[id] = name
        return id
      }

      function hasCallback(name){
        return !!records[name]
      }

      function callbacks(name){ 
       return Object.values(records[name] || {})
      }

      function unregister(id){
        var name = ids[id]
        delete records[name][id]
      }

    }

    function SimpleRegister(){
      var me = this;
      var records = {}

      me.register = register
      me.callbacks = callbacks
      me.unregister = unregister
      me.hasCallback = hasCallback

      function register(name, callback) { records[name] = callback }
      function callbacks(name)          { return me.hasCallback(name) ? [records[name]] : [] }
      function unregister(name)         { delete records[name] }
      function hasCallback(name)        { return !!records[name] }

    }
      
  }

})();
})();