angular  websocket for rtc
==============

AngularJS providers for chat implementation using websocket and webrtc

---

### note

Websocket service is wrapper for angularWebsocket that provides to RtcPeerConnection tools to connect with a websocket server to initialize communication. Once initial handshakes are done, webrtc takes charge of chat messaging.

https://github.com/fmieres/websocket-server-test can be used as websocket server \
https://github.com/coturn/coturn can be used as iceServer. (needed if clients are behind NAT)

---

Installation
------------

Only method of installation:
* Through bower: `bower install fmieres/ng-websocket-for-rtc --save`



### Import Angular module
 
```js
var ngModule = angular.module('fooApp',['ng-websocket-for-rtc']);
```


### Use in controller
 
```js
angular.module('fooApp')
    .controller('FooCtrl', ['$scope', 'WebScoket','RTCPeerConnection', function ($scope, WebSocket, RTCPeerConnection) {
    var videoElement = queryVideoElement()
    RTCPeerConnection.initialize(WebSocket, undefined, { 
      onMessageReceived : function(text){
        // handle chat message received via webrtc datachannel
      },
      onAckMessageReceived : function(id){},
      onAddStream : function(event){
        $scope.$apply(function(){
          videoElement.srcObject = event.stream;
        })
      },
    })
    
    //...
    
    function sendChatMessage(message){
      //...
      RTCPeerConnection.peer.sendMessage(message, id)
    }
    
    }]);
```


### Configuration

```js
var ngModule = angular.module('fooApp');
ngModule.config(function(WebSocketProvider, RTCPeerConnectionProvider){
  WebSocketProvider.webSocketUrl("MyWebsocketServerUrl")
  RTCPeerConnectionProvider.setICEServers([
    { urls : "turn:myTurnServerIp", credential : "password", username :"username" }
  ])
  RTCPeerConnectionProvider.setType(RTCPeerConnectionProvider.LISTENER) // default SPEAKER
}
```


License
----

Released under the terms of the [MIT License](LICENSE).