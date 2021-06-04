var crypto = require('crypto');

// sxpress-session
function cookieParser(cookieStr) {
  var cookies = {};  // 解析结果
  // 通过; 切分cookies列表
  var cookieList = cookieStr.split('; ');

  for (var i = 0; i < cookieList.length; i++) {
    // 通过=切分cookie的key和value
    var cookieItem = cookieList[i].split('=');

    cookies[cookieItem[0]] = cookieItem[1];
  }

  return cookies;
}

// 生成唯一标识
function GUID() {
  let guid = '';

  for (let i = 1; i <= 32; i++) {
    let n = Math.floor(Math.random() * 16.0).toString(16);

    n = Math.random() < 0.5 ? n.toUpperCase() : n;

    guid += n;

    if (i == 8 || i == 12 || i == 16 || i == 20) {
      guid += Math.random() < 0.5 ? '-' : '_';
    }
  }

  return guid;
}

// 查找session索引
function findSessionIndex(id, sessions) {
  for (var i = 0; i < sessions.length; i++) {
    if (sessions[i].id === id) {
      return i;
    }
  }

  return -1;
}

// 删除session
function removeSession(id, sessions) {
  for (var i = 0; i < sessions.length; i++) {
    if (sessions[i].id === id) {
      sessions.splice(i, 1);

      break;
    }
  }
}

// 检查session有效期，返回true过期，false未过期
function checkSessionExpired(id, sessions) {
  var _session = null;
  var _expired = false;
  var _nowTime = new Date().toString();

  for (var i = 0; i < sessions.length; i++) {
    if (sessions[i].id === id) {
      _session = sessions[i];

      break;
    }
  }

  // 如果当前时间小于有session有效期则有效
  if (_session && +new Date(_nowTime) > +new Date(_session.cookie.expires)) {
    _expired = true;
  }
    
  return _expired;
}

// 清除过期session
function clearTimeoutSession(sessions) {
  var session = null;

  for (var i = 0; i < sessions.length; i++) {
    session = sessions[i];

    if (checkSessionExpired(session.id, sessions)) {
      removeSession(session.id, sessions);
    }
  }
}

function Session(options) {
  var that = this;
  var sxpressInstance = global.sxpressInstance;

  this.timeout = options.timeout || 20 * 60 * 1000;  // session过期时间，默认20分钟
  this.name = options.name || 'JSSESSIONID';
  this.secret = options.secret || 'sxpress-session';
  this.cookie = {
    httpOnly: true,
  };

  // 复制options中cookie配置
  if (options.cookie) {
    for (var key in options.cookie) {
      this.cookie[key] = options.cookie[key]
    }
  }

  // 挂载sessions列表至sxpress实例上
  if (!sxpressInstance._sessions) {
    sxpressInstance._sessions = [];
  }

  // 每1分钟清除过期session
  setInterval(function () {
    clearTimeoutSession(sxpressInstance._sessions);
  }, 1 * 60 * 1000);

  return coreMiddleware;

  // 中间件函数
  function coreMiddleware(req, res, next) {
    var nowTime = new Date();
    var lastTime = new Date();
    var cookies = req.cookies || cookieParser(req.headers.cookie || '');
    var session = null;
    var sessions = sxpressInstance._sessions;
    var sessionId = null;
    var sessionIndex = -1;
    var sessionExpired = false;  // session是否过期
    var sessionExpires = new Date(+nowTime + that.timeout).toString();  // session过期时间
    

    // cookie默认20分钟有效期
    that.cookie.expires = sessionExpires;

    // console.log('sessions', sessions);

    if (cookies[that.name]) {
      // console.log('cookie-session存在');

      // session存在
      // 1. 查找session
      sessionIndex = findSessionIndex(cookies[that.name], sessions);

      // 2. 未找到返回提示
      if (sessionIndex === -1) {
        // console.log('session无效');

        return res.send({
          code: 2000,
          data: null,
          msg: 'session无效'
        });
      }

      // 3. 找到检查有效期
      if (sessionIndex !== -1) {
        // console.log('检查session有效期');

        session = sessions[sessionIndex];
        sessionId = session.id;
        sessionExpired = checkSessionExpired(sessionId, sessions);
      }

      // 4. 未过期则续期，刷新cookie及session有效期，且调用next
      if (!sessionExpired) {
        // console.log('session未过期');
        // console.log('刷新cookie有效期');

        res.cookie(that.name, session.id, that.cookie);

        // console.log('刷新session有效期', that.cookie);
        session.cookie.expires = that.cookie.expires;
        session.lastTime = lastTime.toString();

        req.session = {};

        for (var key in session) {
          req.session[key] = session[key];
        }

        return next();
      }

      // 5. 过期返回提示
      if (sessionExpired) {
        // console.log('session过期')

        return res.send({
          code: 2001,
          data: null,
          msg: 'session过期'
        });
      }
    } else {
      var hmac = crypto.createHmac('md5', that.secret);
      // 生成GUID
      var id = hmac.update(GUID() + Math.random() + +new Date()).digest('hex');
      // console.log('cookie-session不存在');

      // session不存在
      // 1. 创建cookie
      res.cookie(that.name, id, that.cookie);

      var cookie = {};

      for (var key in that.cookie) {
        cookie[key] = that.cookie[key];
      }

      // 2. 创建req.session
      req.session = {
        cookie: cookie,
        lastUrl: req.url,
        lastTime: lastTime.toString()
      };

      // 3. 将session放入sxpressInstance._sessions中
      sxpressInstance._sessions.push({
        id: id,
        cookie: cookie,
        lastUrl: req.url,
        lastTime: lastTime.toString()
      });
    }

    next();
  }
}
  
module.exports = function (options) {
  return new Session(options);
};
