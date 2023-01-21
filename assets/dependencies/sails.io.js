(function () {

  var SOCKET_OPTIONS = [
    "useCORSRouteToGetCookie",
    "url",
    "multiplex",
    "transports",
    "query",
    "path",
    "headers",
    "initialConnectionHeaders",
    "reconnection",
    "reconnectionAttempts",
    "reconnectionDelay",
    "reconnectionDelayMax",
    "rejectUnauthorized",
    "randomizationFactor",
    "timeout",
  ];

  var CONFIGURABLE_VIA_HTML_ATTR = [
    "autoConnect",
    "reconnection",
    "environment",
    "headers",
    "url",
    "transports",
    "path",
  ];

  var CONNECTION_METADATA_PARAMS = {
    version: "__sails_io_sdk_version",
    platform: "__sails_io_sdk_platform",
    language: "__sails_io_sdk_language",
  };

  var SDK_INFO = {
    version: "1.2.1",
    language: "javascript",
    platform: (function () {
      if (typeof module === "object" && typeof module.exports !== "undefined") {
        return "node";
      } else {
        return "browser";
      }
    })(),
  };

  SDK_INFO.versionString =
    CONNECTION_METADATA_PARAMS.version +
    "=" +
    SDK_INFO.version +
    "&" +
    CONNECTION_METADATA_PARAMS.platform +
    "=" +
    SDK_INFO.platform +
    "&" +
    CONNECTION_METADATA_PARAMS.language +
    "=" +
    SDK_INFO.language;

  var thisScriptTag = (function () {
    if (
      typeof window !== "object" ||
      typeof window.document !== "object" ||
      typeof window.document.getElementsByTagName !== "function"
    ) {
      return null;
    }

    var allScriptsCurrentlyInDOM =
      window.document.getElementsByTagName("script");
    return allScriptsCurrentlyInDOM[allScriptsCurrentlyInDOM.length - 1];
  })();

  var urlThisScriptWasFetchedFrom = "";
  var scriptTagConfig = {};

  if (thisScriptTag) {
    urlThisScriptWasFetchedFrom = thisScriptTag.src;

    CONFIGURABLE_VIA_HTML_ATTR.forEach(function (configKey) {
      scriptTagConfig[configKey] = (function () {
        var htmlAttrVal = thisScriptTag.getAttribute("data-" + configKey);
        if (!htmlAttrVal) {
          htmlAttrVal = thisScriptTag.getAttribute(configKey);
        }

        if (typeof htmlAttrVal === "string") {
          try {
            return JSON.parse(htmlAttrVal);
          } catch (e) {
            return htmlAttrVal;
          }
        } else if (htmlAttrVal === null) {
          return undefined;
        } else
          throw new Error(
            "sails.io.js :: Unexpected/invalid script tag configuration for `" +
              configKey +
              "`: `" +
              htmlAttrVal +
              "` (a `" +
              typeof htmlAttrVal +
              "`). Should be a string."
          );
      })();

      if (scriptTagConfig[configKey] === undefined) {
        delete scriptTagConfig[configKey];
      }
    });

    // `autoConnect`
    if (typeof scriptTagConfig.autoConnect !== "undefined") {
      if (scriptTagConfig.autoConnect === "") {
        // Special case for empty string.  It means `true` (see above).
        scriptTagConfig.autoConnect = true;
      } else if (typeof scriptTagConfig.autoConnect !== "boolean") {
        throw new Error(
          "sails.io.js :: Unexpected/invalid configuration for `autoConnect` provided in script tag: `" +
            scriptTagConfig.autoConnect +
            "` (a `" +
            typeof scriptTagConfig.autoConnect +
            "`). Should be a boolean."
        );
      }
    }

    // `environment`
    if (typeof scriptTagConfig.environment !== "undefined") {
      if (typeof scriptTagConfig.environment !== "string") {
        throw new Error(
          "sails.io.js :: Unexpected/invalid configuration for `environment` provided in script tag: `" +
            scriptTagConfig.environment +
            "` (a `" +
            typeof scriptTagConfig.environment +
            "`). Should be a string."
        );
      }
    }

    // `headers`
    if (typeof scriptTagConfig.headers !== "undefined") {
      if (
        typeof scriptTagConfig.headers !== "object" ||
        Array.isArray(scriptTagConfig.headers)
      ) {
        throw new Error(
          "sails.io.js :: Unexpected/invalid configuration for `headers` provided in script tag: `" +
            scriptTagConfig.headers +
            "` (a `" +
            typeof scriptTagConfig.headers +
            '`). Should be a JSON-compatible dictionary (i.e. `{}`).  Don\'t forget those double quotes (""), even on key names!  Use single quotes (\'\') to wrap the HTML attribute value; e.g. `headers=\'{"X-Auth": "foo"}\'`'
        );
      }
    }

    // `url`
    if (typeof scriptTagConfig.url !== "undefined") {
      if (typeof scriptTagConfig.url !== "string") {
        throw new Error(
          "sails.io.js :: Unexpected/invalid configuration for `url` provided in script tag: `" +
            scriptTagConfig.url +
            "` (a `" +
            typeof scriptTagConfig.url +
            "`). Should be a string."
        );
      }
    }
  }

  var _existingGlobalSocketIO = typeof io !== "undefined" ? io : undefined;

  function SailsIOClient(_providedSocketIO) {
    var io;
    if (_providedSocketIO) {
      io = _providedSocketIO;
    } else {
      io = _existingGlobalSocketIO;
    }
    if (!io) {
      // If node:
      if (SDK_INFO.platform === "node") {
        throw new Error(
          "No socket.io client available.  When requiring `sails.io.js` from Node.js, a socket.io client (`io`) must be passed in; e.g.:\n```\nvar io = require('sails.io.js')( require('socket.io-client') )\n```\n(see https://github.com/balderdashy/sails.io.js/tree/master/test for more examples)"
        );
      }
      // Otherwise, this is a web browser:
      else {
        throw new Error(
          "The Sails socket SDK depends on the socket.io client, but the socket.io global (`io`) was not available when `sails.io.js` loaded.  Normally, the socket.io client code is bundled with sails.io.js, so something is a little off.  Please check to be sure this version of `sails.io.js` has the minified Socket.io client at the top of the file."
        );
      }
    }

    // If the chosen socket.io client (`io`) has ALREADY BEEN AUGMENTED by this SDK,
    // (i.e. if it already has a `.sails` property) then throw an error.
    if (io.sails) {
      // If node:
      if (SDK_INFO.platform === "node") {
        throw new Error(
          "The provided socket.io client (`io`) has already been augmented into a Sails socket SDK instance (it has `io.sails`)."
        );
      }
      // Otherwise, this is a web browser:
      else {
        throw new Error(
          "The socket.io client (`io`) has already been augmented into a Sails socket SDK instance.  Usually, this means you are bringing `sails.io.js` onto the page more than once."
        );
      }
    }

    /**
     * A little logger for this library to use internally.
     * Basically just a wrapper around `console.log` with
     * support for feature-detection.
     *
     * @api private
     * @factory
     */
    function LoggerFactory(options) {
      options = options || {
        prefix: true,
      };

      // If `console.log` is not accessible, `log` is a noop.
      if (
        typeof console !== "object" ||
        typeof console.log !== "function" ||
        typeof console.log.bind !== "function"
      ) {
        return function noop() {};
      }

      return function log() {
        var args = Array.prototype.slice.call(arguments);

        // All logs are disabled when `io.sails.environment = 'production'`.
        if (io.sails.environment === "production") return;

        // Add prefix to log messages (unless disabled)
        var PREFIX = "";
        if (options.prefix) {
          args.unshift(PREFIX);
        }

        // Call wrapped logger
        console.log.bind(console).apply(this, args);
      };
    } //</LoggerFactory>

    // Create a private logger instance
    var consolog = LoggerFactory();
    consolog.noPrefix = LoggerFactory({
      prefix: false,
    });

    /**
     * What is the `requestQueue`?
     *
     * The request queue is used to simplify app-level connection logic--
     * i.e. so you don't have to wait for the socket to be connected
     * to start trying to  synchronize data.
     *
     * @api private
     * @param  {SailsSocket}  socket
     */

    function runRequestQueue(socket) {
      var queue = socket.requestQueue;

      if (!queue) return;
      for (var i in queue) {
        var isSafeToDereference = {}.hasOwnProperty.call(queue, i);
        if (isSafeToDereference) {
          var requestArgs = queue[i];
          // Call the request method again in the context of the socket, with the original args
          socket.request.apply(socket, requestArgs);
        }
      }
      socket.requestQueue = null;
    }

    /**
     * Send a JSONP request.
     *
     * @param  {Object}   opts [optional]
     * @param  {Function} cb
     * @return {XMLHttpRequest}
     */

    function jsonp(opts, cb) {
      opts = opts || {};

      if (typeof window === "undefined") {
        // FUTURE: refactor node usage to live in here
        return cb();
      }

      var scriptEl = document.createElement("script");
      window._sailsIoJSConnect = function (response) {
        if (scriptEl && scriptEl.parentNode) {
          scriptEl.parentNode.removeChild(scriptEl);
        }

        cb(response);
      };
      scriptEl.src = opts.url;
      document.getElementsByTagName("head")[0].appendChild(scriptEl);
    }

    /**
     * The JWR (JSON WebSocket Response) received from a Sails server.
     *
     * @api public
     * @param  {Object}  responseCtx
     *         => :body
     *         => :statusCode
     *         => :headers
     *
     * @constructor
     */

    function JWR(responseCtx) {
      this.body = responseCtx.body;
      this.headers = responseCtx.headers || {};
      this.statusCode =
        typeof responseCtx.statusCode === "undefined"
          ? 200
          : responseCtx.statusCode;

      if (this.statusCode < 200 || this.statusCode >= 400) {
        // Determine the appropriate error message.
        var msg;
        if (this.statusCode === 0) {
          msg = "The socket request failed.";
        } else {
          msg = "Server responded with a " + this.statusCode + " status code";
          msg += ":\n```\n" + JSON.stringify(this.body, null, 2) + "\n```";
        }
        this.error = new Error(msg);
      }
    }
    JWR.prototype.toString = function () {
      return (
        "[ResponseFromSails]" +
        "  -- " +
        "Status: " +
        this.statusCode +
        "  -- " +
        "Headers: " +
        this.headers +
        "  -- " +
        "Body: " +
        this.body
      );
    };
    JWR.prototype.toPOJO = function () {
      return {
        body: this.body,
        headers: this.headers,
        statusCode: this.statusCode,
      };
    };
    JWR.prototype.pipe = function () {
      // FUTURE: look at substack's stuff
      return new Error("Client-side streaming support not implemented yet.");
    };

    /**
     * @api private
     * @param  {SailsSocket} socket  [description]
     * @param  {Object} requestCtx [description]
     */

    function _emitFrom(socket, requestCtx) {
      if (!socket._raw) {
        throw new Error(
          "Failed to emit from socket- raw SIO socket is missing."
        );
      }
      var cb = requestCtx.cb;
      delete requestCtx.cb;

      var sailsEndpoint = requestCtx.method;

      socket._raw.emit(
        sailsEndpoint,
        requestCtx,
        function serverResponded(responseCtx) {
          if (cb && !requestCtx.calledCb) {
            cb(responseCtx.body, new JWR(responseCtx));
            // Set flag indicating that callback was called, to avoid duplicate calls.
            requestCtx.calledCb = true;
            // Remove the callback from the list.
            socket._responseCbs.splice(socket._responseCbs.indexOf(cb), 1);
            // Remove the context from the list.
            socket._requestCtxs.splice(
              socket._requestCtxs.indexOf(requestCtx),
              1
            );
          }
        }
      );
    }

    /**
     * SailsSocket
     *
     * A wrapper for an underlying Socket instance that communicates directly
     * to the Socket.io server running inside of Sails.
     *
     * If no `socket` option is provied, SailsSocket will function as a mock. It will queue socket
     * requests and event handler bindings, replaying them when the raw underlying socket actually
     * connects. This is handy when we don't necessarily have the valid configuration to know
     * WHICH SERVER to talk to yet, etc.  It is also used by `io.socket` for your convenience.
     *
     * @constructor
     * @api private
     *
     * ----------------------------------------------------------------------
     * Note: This constructor should not be used directly. To obtain a `SailsSocket`
     * instance of your very own, run:
     * ```
     * var mySocket = io.sails.connect();
     * ```
     * ----------------------------------------------------------------------
     */
    function SailsSocket(opts) {
      var self = this;
      opts = opts || {};

      // Initialize private properties
      self._isConnecting = false;
      self._mightBeAboutToAutoConnect = false;

      // Set up connection options so that they can only be changed when socket is disconnected.
      var _opts = {};
      SOCKET_OPTIONS.forEach(function (option) {
        // Okay to change global headers while socket is connected
        if (option == "headers") {
          return;
        }
        Object.defineProperty(self, option, {
          get: function () {
            if (option == "url") {
              return (
                _opts[option] || (self._raw && self._raw.io && self._raw.io.uri)
              );
            }
            return _opts[option];
          },
          set: function (value) {
            // Don't allow value to be changed while socket is connected
            if (
              self.isConnected() &&
              io.sails.strict !== false &&
              value != _opts[option]
            ) {
              throw new Error(
                "Cannot change value of `" +
                  option +
                  "` while socket is connected."
              );
            }
            // If socket is attempting to reconnect, stop it.
            if (
              self._raw &&
              self._raw.io &&
              self._raw.io.reconnecting &&
              !self._raw.io.skipReconnect
            ) {
              self._raw.io.skipReconnect = true;
              consolog(
                "Stopping reconnect; use .reconnect() to connect socket after changing options."
              );
            }
            _opts[option] = value;
          },
        });
      });

      SOCKET_OPTIONS.forEach(function (option) {
        self[option] = opts[option];
      });

      // Set up "eventQueue" to hold event handlers which have not been set on the actual raw socket yet.
      self.eventQueue = {};

      self.on("sails:parseError", function (err) {
        consolog(
          "Sails encountered an error parsing a socket message sent from this client, and did not have access to a callback function to respond with."
        );
        consolog("Error details:", err);
      });
    }

    /**
     * `SailsSocket.prototype._connect()`
     *
     * Begin connecting this socket to the server.
     *
     * @api private
     */
    SailsSocket.prototype._connect = function () {
      var self = this;

      self._isConnecting = true;

      SOCKET_OPTIONS.forEach(function (option) {
        if ("undefined" == typeof self[option]) {
          self[option] = io.sails[option];
        }
      });

      self.extraHeaders = self.initialConnectionHeaders || {};

      self.transportOptions = self.transportOptions || {};
      self.transports.forEach(function (transport) {
        self.transportOptions[transport] =
          self.transportOptions[transport] || {};
        self.transportOptions[transport].extraHeaders =
          self.initialConnectionHeaders || {};
      });

      if (
        (self.initialConnectionHeaders &&
          SDK_INFO.platform !== "node" &&
          self.transports.indexOf("polling") === -1) ||
        self.transports.length > 1
      ) {
        if (typeof console === "object" && typeof console.warn === "function") {
          console.warn(
            "When running in browser, `initialConnectionHeaders` option is only available for the `polling` transport."
          );
        }
      }

      // Ensure URL has no trailing slash
      self.url = self.url ? self.url.replace(/(\/)$/, "") : undefined;

      // Mix the current SDK version into the query string in
      // the connection request to the server:
      if (typeof self.query === "string") {
        self.query = self.query.replace(/^\?/, "");
        self.query += "&" + SDK_INFO.versionString;
      } else if (self.query && typeof self.query === "object") {
        throw new Error(
          "`query` setting does not currently support configuration as a dictionary (`{}`).  Instead, it must be specified as a string like `foo=89&bar=hi`"
        );
      } else if (!self.query) {
        self.query = SDK_INFO.versionString;
      } else {
        throw new Error(
          "Unexpected data type provided for `query` setting: " + self.query
        );
      }

      var isXOrigin = (function () {
        if (
          typeof window === "undefined" ||
          typeof window.location === "undefined"
        ) {
          return false;
        }
        if (typeof self.url !== "string") {
          return false;
        }

        var targetProtocol = (function () {
          try {
            targetProtocol = self.url.match(/^([a-z]+:\/\/)/i)[1].toLowerCase();
          } catch (e) {}
          targetProtocol = targetProtocol || "http://";
          return targetProtocol;
        })();
        var isTargetSSL = !!self.url.match("^https");
        var targetPort = (function () {
          try {
            return self.url.match(/^[a-z]+:\/\/[^:]*:([0-9]*)/i)[1];
          } catch (e) {}
          return isTargetSSL ? "443" : "80";
        })();
        var targetAfterProtocol = self.url.replace(/^([a-z]+:\/\/)/i, "");

        if (
          targetProtocol.replace(/[:\/]/g, "") !==
          window.location.protocol.replace(/[:\/]/g, "")
        ) {
          return true;
        }

        // If target hostname is different than actual hostname, we'll consider this cross-origin.
        var hasSameHostname =
          targetAfterProtocol.search(window.location.hostname) === 0;
        if (!hasSameHostname) {
          return true;
        }

        // If no actual port is explicitly set on the `window.location` object,
        // we'll assume either 80 or 443.
        var isLocationSSL = window.location.protocol.match(/https/i);
        var locationPort =
          window.location.port + "" || (isLocationSSL ? "443" : "80");

        // Finally, if ports don't match, we'll consider this cross-origin.
        if (targetPort !== locationPort) {
          return true;
        }

        // Otherwise, it's the same origin.
        return false;
      })();

      // Prepare to start connecting the socket
      (function selfInvoking(cb) {
        if (!(self.useCORSRouteToGetCookie && isXOrigin)) {
          return cb();
        }

        var xOriginCookieURL = self.url;
        if (typeof self.useCORSRouteToGetCookie === "string") {
          xOriginCookieURL += self.useCORSRouteToGetCookie;
        } else {
          xOriginCookieURL += "/__getcookie";
        }

        // Make the AJAX request (CORS)
        jsonp(
          {
            url: xOriginCookieURL,
            method: "GET",
          },
          cb
        );
      })(function goAheadAndActuallyConnect() {
        self._raw = io(self.url, self);

        self._raw.io.engine.transport.on("error", function (err) {
          if (!self._isConnecting) {
            return;
          }

          self._isConnecting = false;

          self.connectionErrorTimestamp = new Date().getTime();

          // Development-only message:
          consolog("====================================");
          consolog("The socket was unable to connect.");
          consolog("The server may be offline, or the");
          consolog("socket may have failed authorization");
          consolog("based on its origin or other factors.");
          consolog("You may want to check the values of");
          consolog("`sails.config.sockets.onlyAllowOrigins`");
          consolog("or (more rarely) `sails.config.sockets.beforeConnect`");
          consolog("in your app.");
          consolog("More info: https://sailsjs.com/config/sockets");
          consolog("For help: https://sailsjs.com/support");
          consolog("");
          consolog("Technical details:");
          consolog(err);
          consolog("====================================");
        });

        self.replay();

        /**
         * 'connect' event is triggered when the socket establishes a connection
         *  successfully.
         */
        self.on("connect", function socketConnected() {
          self._isConnecting = false;
          consolog.noPrefix(
            "\n" +
              "\n" +
              // '    |>    ' + '\n' +
              // '  \\___/  '+️
              // '\n'+
              "  |>    Now connected to " +
              (self.url ? self.url : "Sails") +
              "." +
              "\n" +
              "\\___/   For help, see: http://bit.ly/2q0QDpf" +
              "\n" +
              "        (using sails.io.js " +
              io.sails.sdk.platform +
              " SDK @v" +
              io.sails.sdk.version +
              ")" +
              "\n" +
              "         Connected at: " +
              new Date() +
              "\n" +
              "\n" +
              "\n" +
              // '\n'+
              ""
            // ' ⚓︎ (development mode)'
            // 'e.g. to send a GET request to Sails via WebSockets, run:'+ '\n' +
            // '`io.socket.get("/foo", function serverRespondedWith (body, jwr) { console.log(body); })`'+ '\n' +
          );
        });

        self.on("disconnect", function () {
          // Get a timestamp of when the disconnect was detected.
          self.connectionLostTimestamp = new Date().getTime();

          // Get a shallow clone of the internal array of response callbacks, in case any of the callbacks mutate it.
          var responseCbs = [].concat(self._responseCbs || []);
          // Wipe the internal array of response callbacks before executing them, in case a callback happens to add
          // a new request to the queue.
          self._responseCbs = [];

          // Do the same for the internal request context list.
          var requestCtxs = [].concat(self._requestCtxs || []);
          self._requestCtxs = [];

          // Loop through the callbacks for all in-progress requests, and call them each with an error indicating the disconnect.
          if (responseCbs.length) {
            responseCbs.forEach(function (responseCb) {
              responseCb(
                new Error(
                  "The socket disconnected before the request completed."
                ),
                {
                  body: null,
                  statusCode: 0,
                  headers: {},
                }
              );
            });
          }

          // If there is a list of request contexts, indicate that their callbacks have been
          // called and then wipe the list.  This prevents errors in the edge case of a response
          // somehow coming back after the socket reconnects.
          if (requestCtxs.length) {
            requestCtxs.forEach(function (requestCtx) {
              requestCtx.calledCb = true;
            });
          }

          consolog("====================================");
          consolog("Socket was disconnected from Sails.");
          consolog(
            "Usually, this is due to one of the following reasons:" +
              "\n" +
              " -> the server " +
              (self.url ? self.url + " " : "") +
              "was taken down" +
              "\n" +
              " -> your browser lost internet connectivity"
          );
          consolog("====================================");
        });

        self.on("reconnecting", function (numAttempts) {
          consolog(
            "\n" +
              "        Socket is trying to reconnect to " +
              (self.url ? self.url : "Sails") +
              "...\n" +
              "_-|>_-  (attempt #" +
              numAttempts +
              ")" +
              "\n" +
              "\n"
          );
        });

        self.on("reconnect", function (transport, numAttempts) {
          if (!self._isConnecting) {
            self.on("connect", runRequestQueue.bind(self, self));
          }

          var msSinceLastOffline;
          var numSecsOffline;
          if (self.connectionLostTimestamp) {
            msSinceLastOffline =
              new Date().getTime() - self.connectionLostTimestamp;
            numSecsOffline = msSinceLastOffline / 1000;
          } else if (self.connectionErrorTimestamp) {
            msSinceLastOffline =
              new Date().getTime() - self.connectionErrorTimestamp;
            numSecsOffline = msSinceLastOffline / 1000;
          } else {
            msSinceLastOffline = "???";
            numSecsOffline = "???";
          }

          consolog(
            "\n" +
              "  |>    Socket reconnected successfully after" +
              "\n" +
              "\\___/   being offline at least " +
              numSecsOffline +
              " seconds." +
              "\n" +
              "\n"
          );
        });

        self.on("error", function failedToConnect(err) {
          self._isConnecting = false;

          consolog(
            "Failed to connect socket (possibly due to failed `beforeConnect` on server)",
            "Error:",
            err
          );
        });
      });
    };

    /**
     * Reconnect the underlying socket.
     *
     * @api public
     */
    SailsSocket.prototype.reconnect = function () {
      if (this._isConnecting) {
        throw new Error("Cannot connect- socket is already connecting");
      }
      if (this.isConnected()) {
        throw new Error("Cannot connect- socket is already connected");
      }
      return this._connect();
    };

    /**
     * Disconnect the underlying socket.
     *
     * @api public
     */
    SailsSocket.prototype.disconnect = function () {
      this._isConnecting = false;
      if (!this.isConnected()) {
        throw new Error("Cannot disconnect- socket is already disconnected");
      }
      return this._raw.disconnect();
    };

    /**
     * isConnected
     *
     * @return {Boolean} whether the socket is connected and able to
     *                   communicate w/ the server.
     */

    SailsSocket.prototype.isConnected = function () {
      if (!this._raw) {
        return false;
      }

      return !!this._raw.connected;
    };

    /**
     * isConnecting
     *
     * @return {Boolean} whether the socket is in the process of connecting
     *                   to the server.
     */

    SailsSocket.prototype.isConnecting = function () {
      return this._isConnecting;
    };

    /**
     * isConnecting
     *
     * @return {Boolean} flag that is `true` after a SailsSocket instance is
     *                   initialized but before one tick of the event loop
     *                   has passed (so that it hasn't attempted to connect
     *                   yet, if autoConnect ends up being configured `true`)
     */
    SailsSocket.prototype.mightBeAboutToAutoConnect = function () {
      return this._mightBeAboutToAutoConnect;
    };

    /**
     * [replay description]
     * @return {[type]} [description]
     */
    SailsSocket.prototype.replay = function () {
      var self = this;

      for (var evName in self.eventQueue) {
        for (var i in self.eventQueue[evName]) {
          self._raw.on(evName, self.eventQueue[evName][i]);
        }
      }

      if (!self.isConnected()) {
        self._raw.once("connect", runRequestQueue.bind(self, self));
      } else {
        runRequestQueue(self);
      }

      return self;
    };

    /**
     * Chainable method to bind an event to the socket.
     *
     * @param  {String}   evName [event name]
     * @param  {Function} fn     [event handler function]
     * @return {SailsSocket}
     */
    SailsSocket.prototype.on = function (evName, fn) {
      // Bind the event to the raw underlying socket if possible.
      if (this._raw) {
        this._raw.on(evName, fn);
        return this;
      }

      // Otherwise queue the event binding.
      if (!this.eventQueue[evName]) {
        this.eventQueue[evName] = [fn];
      } else {
        this.eventQueue[evName].push(fn);
      }

      return this;
    };

    /**
     * Chainable method to unbind an event from the socket.
     *
     * @param  {String}   evName [event name]
     * @param  {Function} fn     [event handler function]
     * @return {SailsSocket}
     */
    SailsSocket.prototype.off = function (evName, fn) {
      // Bind the event to the raw underlying socket if possible.
      if (this._raw) {
        this._raw.off(evName, fn);
        return this;
      }

      // Otherwise queue the event binding.
      if (this.eventQueue[evName] && this.eventQueue[evName].indexOf(fn) > -1) {
        this.eventQueue[evName].splice(this.eventQueue[evName].indexOf(fn), 1);
      }

      return this;
    };

    /**
     * Chainable method to unbind all events from the socket.
     *
     * @return {SailsSocket}
     */
    SailsSocket.prototype.removeAllListeners = function () {
      // Bind the event to the raw underlying socket if possible.
      if (this._raw) {
        this._raw.removeAllListeners();
        return this;
      }

      // Otherwise queue the event binding.
      this.eventQueue = {};

      return this;
    };

    /**
     * Simulate a GET request to sails
     * e.g.
     *    `socket.get('/user/3', Stats.populate)`
     *
     * @api public
     * @param {String} url    ::    destination URL
     * @param {Object} data   ::    parameters to send with the request [optional]
     * @param {Function} cb   ::    callback function to call when finished [optional]
     */

    SailsSocket.prototype.get = function (url, data, cb) {
      // `data` is optional
      if (typeof data === "function") {
        cb = data;
        data = {};
      }

      return this.request(
        {
          method: "get",
          params: data,
          url: url,
        },
        cb
      );
    };

    /**
     * Simulate a POST request to sails
     * e.g.
     *    `socket.post('/event', newMeeting, $spinner.hide)`
     *
     * @api public
     * @param {String} url    ::    destination URL
     * @param {Object} data   ::    parameters to send with the request [optional]
     * @param {Function} cb   ::    callback function to call when finished [optional]
     */

    SailsSocket.prototype.post = function (url, data, cb) {
      // `data` is optional
      if (typeof data === "function") {
        cb = data;
        data = {};
      }

      return this.request(
        {
          method: "post",
          data: data,
          url: url,
        },
        cb
      );
    };

    /**
     * Simulate a PUT request to sails
     * e.g.
     *    `socket.post('/event/3', changedFields, $spinner.hide)`
     *
     * @api public
     * @param {String} url    ::    destination URL
     * @param {Object} data   ::    parameters to send with the request [optional]
     * @param {Function} cb   ::    callback function to call when finished [optional]
     */

    SailsSocket.prototype.put = function (url, data, cb) {
      // `data` is optional
      if (typeof data === "function") {
        cb = data;
        data = {};
      }

      return this.request(
        {
          method: "put",
          params: data,
          url: url,
        },
        cb
      );
    };

    /**
     * Simulate a PATCH request to sails
     * e.g.
     *    `socket.patch('/event/3', changedFields, $spinner.hide)`
     *
     * @api public
     * @param {String} url    ::    destination URL
     * @param {Object} data   ::    parameters to send with the request [optional]
     * @param {Function} cb   ::    callback function to call when finished [optional]
     */

    SailsSocket.prototype.patch = function (url, data, cb) {
      // `data` is optional
      if (typeof data === "function") {
        cb = data;
        data = {};
      }

      return this.request(
        {
          method: "patch",
          params: data,
          url: url,
        },
        cb
      );
    };

    /**
     * Simulate a DELETE request to sails
     * e.g.
     *    `socket.delete('/event', $spinner.hide)`
     *
     * @api public
     * @param {String} url    ::    destination URL
     * @param {Object} data   ::    parameters to send with the request [optional]
     * @param {Function} cb   ::    callback function to call when finished [optional]
     */

    SailsSocket.prototype["delete"] = function (url, data, cb) {
      // `data` is optional
      if (typeof data === "function") {
        cb = data;
        data = {};
      }

      return this.request(
        {
          method: "delete",
          params: data,
          url: url,
        },
        cb
      );
    };

    /**
     * Simulate an HTTP request to sails
     * e.g.
     * ```
     * socket.request({
     *   url:'/user',
     *   params: {},
     *   method: 'POST',
     *   headers: {}
     * }, function (responseBody, JWR) {
     *   // ...
     * });
     * ```
     *
     * @api public
     * @option {String} url    ::    destination URL
     * @option {Object} params ::    parameters to send with the request [optional]
     * @option {Object} headers::    headers to send with the request [optional]
     * @option {Function} cb   ::    callback function to call when finished [optional]
     * @option {String} method ::    HTTP request method [optional]
     */

    SailsSocket.prototype.request = function (options, cb) {
      var usage =
        "Usage:\n" +
        "socket.request( options, [fnToCallWhenComplete] )\n\n" +
        'options.url :: e.g. "/foo/bar"' +
        "\n" +
        'options.method :: e.g. "get", "post", "put", or "delete", etc.' +
        "\n" +
        'options.params :: e.g. { emailAddress: "mike@example.com" }' +
        "\n" +
        'options.headers :: e.g. { "x-my-custom-header": "some string" }';
      // Old usage:
      // var usage = 'Usage:\n socket.'+(options.method||'request')+'('+
      //   ' destinationURL, [dataToSend], [fnToCallWhenComplete] )';

      // Validate options and callback
      if (typeof cb !== "undefined" && typeof cb !== "function") {
        throw new Error("Invalid callback function!\n" + usage);
      }
      if (typeof options !== "object" || typeof options.url !== "string") {
        throw new Error("Invalid or missing URL!\n" + usage);
      }
      if (options.method && typeof options.method !== "string") {
        throw new Error(
          'Invalid `method` provided (should be a string like "post" or "put")\n' +
            usage
        );
      }
      if (options.headers && typeof options.headers !== "object") {
        throw new Error(
          "Invalid `headers` provided (should be a dictionary with string values)\n" +
            usage
        );
      }
      if (options.params && typeof options.params !== "object") {
        throw new Error(
          "Invalid `params` provided (should be a dictionary with JSON-serializable values)\n" +
            usage
        );
      }
      if (options.data && typeof options.data !== "object") {
        throw new Error(
          "Invalid `data` provided (should be a dictionary with JSON-serializable values)\n" +
            usage
        );
      }

      // Accept either `params` or `data` for backwards compatibility (but not both!)
      if (options.data && options.params) {
        throw new Error(
          "Cannot specify both `params` and `data`!  They are aliases of each other.\n" +
            usage
        );
      } else if (options.data) {
        options.params = options.data;
        delete options.data;
      }

      if (!this.isConnected()) {
        this.requestQueue = this.requestQueue || [];
        this.requestQueue.push([options, cb]);
        return;
      }

      options.headers = options.headers || {};

      var requestCtx = {
        method: (options.method || "get").toLowerCase(),

        headers: options.headers,

        data: options.params || options.data || {},

        url: options.url.replace(/^(.+)\/*\s*$/, "$1"),

        cb: cb,
      };

      // Get a reference to the callback list, or create a new one.
      this._responseCbs = this._responseCbs || [];

      // Get a reference to the request context list, or create a new one.
      this._requestCtxs = this._requestCtxs || [];

      if (cb) {
        this._responseCbs.push(cb);
        this._requestCtxs.push(requestCtx);
      }

      // Merge global headers in, if there are any.
      if (this.headers && "object" === typeof this.headers) {
        for (var header in this.headers) {
          if (!options.headers.hasOwnProperty(header)) {
            options.headers[header] = this.headers[header];
          }
        }
      }

      // Send the request.
      _emitFrom(this, requestCtx);
    };

    /**
     * Socket.prototype._request
     *
     * Simulate HTTP over Socket.io.
     *
     * @api private
     * @param  {[type]}   options [description]
     * @param  {Function} cb      [description]
     */
    SailsSocket.prototype._request = function (options, cb) {
      throw new Error(
        "`_request()` was a private API deprecated as of v0.11 of the sails.io.js client. Use `.request()` instead."
      );
    };

    io.sails = {
      // Whether to automatically connect a socket and save it as `io.socket`.
      autoConnect: true,

      // Whether to automatically try to reconnect after connection is lost
      reconnection: false,

      // The route (path) to hit to get a x-origin (CORS) cookie
      // (or true to use the default: '/__getcookie')
      useCORSRouteToGetCookie: true,

      environment:
        urlThisScriptWasFetchedFrom.match(/(\#production|\.min\.js)/g) ||
        (typeof window === "object" &&
          window &&
          typeof window.SAILS_LOCALS === "object" &&
          window.SAILS_LOCALS &&
          (window.SAILS_LOCALS._environment === "staging" ||
            window.SAILS_LOCALS._environment === "production"))
          ? "production"
          : "development",

      // The version of this sails.io.js client SDK
      sdk: SDK_INFO,

      // Transports to use when communicating with the server, in the order they will be tried
      transports: ["websocket"],
    };

    CONFIGURABLE_VIA_HTML_ATTR.forEach(function (configKey) {
      if (typeof scriptTagConfig[configKey] !== "undefined") {
        io.sails[configKey] = scriptTagConfig[configKey];
      }
    });

    /**
     * Add `io.sails.connect` function as a wrapper for the built-in `io()` aka `io.connect()`
     * method, returning a SailsSocket. This special function respects the configured io.sails
     * connection URL, as well as sending other identifying information (most importantly, the
     * current version of this SDK).
     *
     * @param  {String} url  [optional]
     * @param  {Object} opts [optional]
     * @return {Socket}
     */
    io.sails.connect = function (url, opts) {
      // Make URL optional
      if ("object" === typeof url) {
        opts = url;
        url = null;
      }

      // Default opts to empty object
      opts = opts || {};

      // If explicit connection url is specified, save it to options
      opts.url = url || opts.url || undefined;

      // Instantiate and return a new SailsSocket- and try to connect immediately.
      var socket = new SailsSocket(opts);
      socket._connect();
      return socket;
    };

    // Build `io.socket` so it exists
    // (note that this DOES NOT start the connection process)
    io.socket = new SailsSocket();

    io.socket._mightBeAboutToAutoConnect = true;

    setTimeout(function () {
      // Indicate that the autoConect timer fired.
      io.socket._mightBeAboutToAutoConnect = false;

      // If autoConnect is disabled, delete the eager socket (io.socket) and bail out.
      if (io.sails.autoConnect === false || io.sails.autoconnect === false) {
        delete io.socket;
        return;
      }

      // consolog('Eagerly auto-connecting socket to Sails... (requests will be queued in the mean-time)');
      io.socket._connect();
    }, 0); // </setTimeout>

    // Return the `io` object.
    return io;
  }

  // Add CommonJS support to allow this client SDK to be used from Node.js.
  if (SDK_INFO.platform === "node") {
    module.exports = SailsIOClient;
  }
  // Add AMD support, registering this client SDK as an anonymous module.
  else if (typeof define === "function" && define.amd) {
    define([], function () {
      return SailsIOClient;
    });
  } else {
    // Otherwise, try to instantiate the client using the global `io`:
    SailsIOClient();
  }
})();
