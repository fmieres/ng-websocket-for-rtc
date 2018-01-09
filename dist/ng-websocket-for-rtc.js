/*!
 * See LICENSE in this repository for license information
 */
(function(){
'use strict';

angular
  .module('ng-websocket-for-rtc', ['ngWebSocket']);

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