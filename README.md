sxpress-session middleware for sxpress

var sxpress = require('sxpress');
var cookieParser = require('sxpress-cookie-parser');
var session = require('sxpress-session');
var app = sxpress();

app.use(cookieParser);
app.use(
  session({
    name: 'sxpressSessionId',
    secret: 'cmc secret',
    cookie: {
      domain: '.01zhuanche.com',
    },
  })
);