
var myBase = {};
var myBaseUrl = {};
var coreCache = {};
var statP2P = {
  p2p:0,
  cdn:0,
  leechers:0,
  seeders:0,
  requests:0
};

(function(videojs){
  videojs.APIP2P = {};
  videojs.APIP2P.startConnect = function (options) {
    var self = this;
    var peer = new Peer(options);
    videojs.APIP2P.options = options;
    videojs.APIP2P.peer = peer;
    peer.on('connection', function (conn){
      // manage /...
      myBase[conn.peer] = conn;
      videojs.APIP2P.initializing(conn, null);
    });
    peer.on("error", function (error){
      console.log("ERROR P2P peerjs", error.type);
      if (error.type == "peer-unavailable"){
        var id = error.message.substring("Could not connect to peer ".length);
        videojs.APIP2P.cleanbase(id);
        var obj = {
          response : null
        };
        var ca = self.callbacks[id];
        if (ca){
          // perdu un leecher
          statP2P.leechers--;
          ca.callback.call(obj, obj, "error no peer", ca.message.url);
          delete self.callbacks[id];
        }else{
          // perdu un seeder
        }
      }
      console.log("ERROR",error.message);
    });
  };

  
  videojs.APIP2P.callbacks = {};


  videojs.APIP2P.cleanbase = function (id) {
    if (myBase[id])
      delete myBase[id];
    for (var i = 0; i < Object.keys(myBaseUrl).length; i++) {
      var url = Object.keys(myBaseUrl)[i];
      if(myBaseUrl[url][id])
        delete myBaseUrl[url][id];
    }
  };

  videojs.APIP2P.sendMyBase = function (conn) {
    var base = {};
    for (var i = 0; i < Object.keys(myBaseUrl).length; i++) {
      var url = Object.keys(myBaseUrl)[i];
      base[url] = Object.keys(myBaseUrl[url]);
    }
    conn.send({
      type:"ABASE",
      data:base,
      id:videojs.APIP2P.peer.id
    });
  };
  videojs.APIP2P.initializing = function (conn, leacher){
    if (!conn){
      console.log("RRRR", "conn error",conn);
      return;
    }
    var self = this;
    // conn.on('error', function (error){
    //   console.log("PEER ERROR", conn.peer, error);
    //   videojs.APIP2P.cleanbase(conn.peer);
    // });
    var cleanfct = function(conn){
      videojs.APIP2P.cleanbase(conn.peer);
      var obj = {
        response : null
      };
      var ca = self.callbacks[conn.peer];
      if (ca){
        ca.callback.call(obj, "error", ca.message.url);
        delete self.callbacks[conn.peer];
      }
    };
    conn.on('error', function (error){
      console.log("PEER ERROR P2P", conn.peer, error);
      cleanfct(conn);
    });
    conn.on('disconnected', function (error){
      console.log("PEER disconnected P2P", conn.peer, error);
      cleanfct(conn);
    });
    conn.on('close', function (error){
      console.log("PEER close P2P", conn.peer, error);
      cleanfct(conn);
    });
    conn.on('open', function (){
      // send my base
      videojs.APIP2P.sendMyBase(conn);

      conn.on('data', function (data){
        //console.log("RCV data");
        console.log("RCV data",conn.peer,data);
        // managing data
        if (data.type == "DATA"){
          var obj = {
            response : data.data
          };
          var ca = self.callbacks[conn.peer];
          // TODO I'm Leecher for url
          if (data.data)
            videojs.APIP2P.imLeecher(data.url, videojs.APIP2P.peer.id, data.data);
          if (!ca)
            return;
          ca.callback.call(obj, obj, data.data == null, ca.message.url);
          delete self.callbacks[conn.peer];
        }

        if (data.type == "ASK"){
          // if i have the content
          
          if (coreCache[data.url]){
            console.log("send data");
            conn.send({
              type: "DATA",
              data:coreCache[data.url],
              url: data.url
            });
          }else{
            console.log("NO data");
            conn.send({
              type: "DATA",
              url: data.url
            });
          }
        }
        if (data.type == "UBASE"){
          var all = data.data;
          if (!myBaseUrl[data.url])
            myBaseUrl[data.url] = {};
          myBaseUrl[data.url][data.id] = conn;
        }
        if (data.type == "ABASE"){
          var all = data.data;
          for (var i = 0; i < Object.keys(all).length; i++) {
            var u = Object.keys(all)[i];
            if (!myBaseUrl[u]){
                myBaseUrl[u]= [];
              }
            for (var j = 0; j < all[u].length; j++){
              var l = all[u][j];
              if (l == videojs.APIP2P.peer.id)
                continue;
              if (!myBaseUrl[u][l]){
                myBaseUrl[u][l] = myBase[l] || 1 ;
              }
            }
          }
          console.log("My Base",Object.keys(myBaseUrl));
        }
      });
      // if callbacks ask
      if (self.callbacks[conn.peer]){
        conn.send(self.callbacks[conn.peer].message);
      }
    });
  };
  videojs.APIP2P.xhrP2P = function (leechers, url, callback){
    // connect to all leechers if no connected
    var selectIndex = Math.floor(Math.random() * leechers.length);
    var error = false;
    for (var i = 0; i < leechers.length; i++) {
      var leecher = leechers[i];
      if (!myBase[leecher]){
        var conn = this.peer.connect(leecher);
        if (!conn){
          if (i == selectIndex){
            error = true;
          }
          continue;
        }
        myBase[leecher] = conn;
        myBaseUrl[url][leechers[i]] = conn;
        // select 1
        if (i == selectIndex){
          // ask for content
          this.callbacks[leechers[i]] = {
            callback: callback,
            message: {
              type: 'ASK',
              url: url
            }
          };
          // fire timer to timeout
        }
        // add inteligene for each leacher
        this.initializing(conn,leechers[i]);
      }else if (i == selectIndex){
        var conn = myBase[leecher];
        this.callbacks[leecher] = {
          callback: callback,
          message: {
            type: 'ASK',
            url: url
          }
        };
        conn.send(this.callbacks[leecher].message);
      }
    }
    if (error){
      callback.call({response:null}, "error", url);
    }
  };
  videojs.APIP2P.updateLeechers = function (url, callback){
    console.log("Update leechers",url);
    var options = {
        method: 'GET',
        timeout: 45 * 1000
      };
      var checkurl = "http://"+videojs.APIP2P.options.host+":"+videojs.APIP2P.options.port+"/peerjs/url/"+window.btoa(url);
      var request = new window.XMLHttpRequest();
      request.open(options.method, checkurl);
      request.onreadystatechange = function() {
        if (this.readyState !== 4) {
          return;
        }
        if (this.response && this.status == 200) {
          var leechers = JSON.parse(this.response);
          for (var i = 0; i < leechers.length; i++) {
            if (leechers[i] == videojs.APIP2P.peer.id){
              // si c'est moi
              leechers.splice(i,1);
              i--;
            }else{
              myBaseUrl[url][leechers[i]] = 1;
            }
          }
          callback(leechers);
        } else {
          callback([]);
        }
      };
      request.send(null);
  };

  videojs.APIP2P.imLeecher = function (url, id, data){
    coreCache[url] = data;
    var options = {
        method: 'GET',
        timeout: 45 * 1000
      };
      var checkurl = "http://"+videojs.APIP2P.options.host+":"+videojs.APIP2P.options.port+"/peerjs/url/"+window.btoa(url)+"/"+id;
      var request = new window.XMLHttpRequest();
      request.open(options.method, checkurl);
      request.onreadystatechange = function() {
        if (this.readyState !== 4) {
          return;
        }
        if (this.response && this.status == 200) {
          console.log("I'm Leecher for :", url);
        } else {
          console.log("ERROR setting leecher for :", url);
        }
      };
      request.send(null);

      // say to all my leecher that i'm leacher of this content
      console.log(myBase);
      for (var i = 0; i < Object.keys(myBase).length; i++) {
        var l = Object.keys(myBase)[i];
        if (myBase[l]){
          myBase[l].send({
            type: "UBASE",
            url:url,
            id:videojs.APIP2P.peer.id
          });
        }
      };
  };

})(window.videojs);
(function(videojs){
  /**
   * Creates and sends an XMLHttpRequest.
   * TODO - expose video.js core's XHR and use that instead
   *
   * @param options {string | object} if this argument is a string, it
   * is intrepreted as a URL and a simple GET request is
   * inititated. If it is an object, it should contain a `url`
   * property that indicates the URL to request and optionally a
   * `method` which is the type of HTTP request to send.
   * @param callback (optional) {function} a function to call when the
   * request completes. If the request was not successful, the first
   * argument will be falsey.
   * @return {object} the XMLHttpRequest that was initiated.
   */
   videojs.Hls.xhr = function(url_C, callback) {
    // return videojs.Hls.xhrCDN(url_C, callback);
    // console.log(url_C);
    try {
      var url = url_C;
      if (typeof url_C === 'object') {
        url = url_C.url;
      }
      
      console.log("Call url", url);
      var self = this;
      if (url.indexOf(".ts") < 0){
        if (!myBaseUrl[url]){
          myBaseUrl[url] = {};//responseType:"arraybuffer"
        }
        return videojs.Hls.xhrCDN(url, callback);
      }else {
        if (!myBaseUrl[url]){
          myBaseUrl[url] = {};
        }
        if (Object.keys(myBaseUrl[url]).length > 0){
          // have leacher
          videojs.Hls.xhrP2P(Object.keys(myBaseUrl[url]), url, callback);
          console.log("I know leechers");
          // update leachers
          videojs.APIP2P.updateLeechers(url, function (leechers){});
          return {
            abort:function(){
              console.log("========================================================================");
            }
          };
        }
      }
      if (typeof callback !== 'function') {
        callback = function() {};
      }
      // videojs.Hls.xhrCDN(url, callback);

      console.log("Want leechers");
      videojs.APIP2P.updateLeechers(url, function (leechers){
        if (leechers.length){
          videojs.Hls.xhrP2P(leechers, url, callback);
        }else{
          videojs.Hls.xhrCDN(url, callback);
        }
      });
      return {
        abort:function(){
          console.log("========================================================================");
        }
      };
    }catch (e){
      console.log(e);
    }
    return {
      abort:function(){
        console.log("========================================================================");
      }
    };
   };

   videojs.Hls.xhrP2P = function(leechers, url, callback) {
      console.log("CALL P2P", url);
      var sender = {
        requestTime: new Date().getTime()
      };
      videojs.APIP2P.xhrP2P(leechers,url,function(obj, error, url_cb){
        if (error){
          // leecher fail
          return videojs.Hls.xhrCDN(url, callback);
        }
        sender.responseTime = new Date().getTime();
        sender = videojs.util.mergeOptions(sender,{
          roundTripTime : sender.responseTime - sender.requestTime,
          bytesReceived : obj.response.byteLength || obj.response.length,
          status:200 
        });
        sender.bandwidth = Math.floor((sender.bytesReceived / sender.roundTripTime) * 8 * 1000),
        sender.responseType = "arraybuffer";
        sender = videojs.util.mergeOptions(sender,obj);
        console.log(sender);
        statP2P.p2p += sender.bytesReceived;
        callback.call(sender,false,url);
      });
   };



  videojs.Hls.xhrCDN = function(url, callback) {
    console.log("CALL CDN", url);
    var
      options = {
        method: 'GET',
        timeout: 45 * 1000
      },
      request,
      abortTimeout;

    if (typeof callback !== 'function') {
      callback = function() {};
    }

    if (typeof url === 'object') {
      options = videojs.util.mergeOptions(options, url);
      url = options.url;
    }
    if (url.indexOf(".ts") > -1){
      options.responseType = "arraybuffer";
    }

    request = new window.XMLHttpRequest();
    request.open(options.method, url);
    request.url = url;
    request.requestTime = new Date().getTime();

    if (options.responseType) {
      request.responseType = options.responseType;
    }
    if (options.withCredentials) {
      request.withCredentials = true;
    }
    if (options.timeout) {
      abortTimeout = window.setTimeout(function() {
        if (request.readyState !== 4) {
          request.timedout = true;
          request.abort();
        }
      }, options.timeout);
    }

    request.onreadystatechange = function() {
      // wait until the request completes
      if (this.readyState !== 4) {
        return;
      }

      // clear outstanding timeouts
      window.clearTimeout(abortTimeout);

      // request timeout
      if (request.timedout) {
        return callback.call(this, 'timeout', url);
      }

      // request aborted or errored
      if (this.status >= 400 || this.status === 0) {
        return callback.call(this, true, url);
      }

      if (this.response) {
        this.responseTime = new Date().getTime();
        this.roundTripTime = this.responseTime - this.requestTime;
        this.bytesReceived = this.response.byteLength || this.response.length;
        this.bandwidth = Math.floor((this.bytesReceived / this.roundTripTime) * 8 * 1000);
        statP2P.cdn += this.bytesReceived;
      }
      videojs.APIP2P.imLeecher(url, videojs.APIP2P.peer.id, this.response);
      //console.log(this);
      return callback.call(this, false, url);
    };
    request.send(null);
    return request;
  };

})(window.videojs);


window.apiCDNP2P = function(options){
  // Videojs hls wrapper
  if (window.videojs && window.videojs.Hls){
    var baseopt = {host:"127.0.0.1",port:"9000",key: 'peerjs',debug:3};
    baseopt = window.videojs.util.mergeOptions(baseopt, options);
    window.videojs.APIP2P.startConnect(baseopt);
  }
};
