var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var timeout = require('connect-timeout');
const request = require('tinyreq');
const cheerio = require('cheerio');
const readline = require('readline');
var cytoscape = require('cytoscape');
var cy = cytoscape();
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const base = "http://www.imdb.com";
var index = require('./routes/index');

var app = express();

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');

app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(timeout(60000));

app.use('/', index);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function (err, req, res, next) {
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};
  res.status(err.status || 500);
  res.render('error');
});

var server = require('http').createServer(app);
var io = require('socket.io')(server);
io.on('connection', function (socket) {
  console.log('> client connected!');

  socket.on('search', function (data) {
    findBaconNumber(data.target_url, data.source_url, socket);
  });


});
server.listen(3001);



function getId(url) {
  var parts = url.split('/');
  for (var i = 0; i < parts.length; i++) {
    var part = parts[i].substring(0, 2);
    if (part === "tt" || part === "nm") { return parts[i]; }
  }
  return '';
}

function fetchActors(movieUrl, callback) {
  var x = [];
  request(movieUrl, function (err, body) {
    var $ = cheerio.load(body);
    var actorList = $(".itemprop", ".cast_list");
    actorList.map(function (i) {
      var actorName = $(".itemprop[itemprop='name']", actorList[i]).text();
      var actorUrl = base + $("a", actorList[i]).attr('href');
      if (actorName && actorUrl) {
        x.push({
          'id': getId(actorUrl),
          'actor_name': actorName,
          'actor_url': actorUrl
        });
      }
    });
    callback(x);
  });
}

function fetchMovies(actorUrl, callback) {
  var x = [];
  request(actorUrl, function (err, body) {
    var $ = cheerio.load(body);
    var movieListContainer = $(".filmo-category-section").first();
    var movieList = $(".filmo-row", movieListContainer);
    movieList.map(function (i) {
      var movieName = $("a", "b", movieList[i]).text();
      var movieUrl = base + $("a", "b", movieList[i]).attr('href');
      if (movieName && movieUrl) {
        x.push({
          'id': getId(movieUrl),
          'movie_name': movieName,
          'movie_url': movieUrl
        });
      }
    });
    callback(x);
  });
}

function findBaconNumber(targetUrl, sourceUrl, socket) {
  var result = null;
  var targetId = getId(targetUrl);
  var sourceId = getId(sourceUrl);

  socket.emit('add-node', {
    data: {
      id: targetId,
      title: 'Target'
    }
  });
  socket.emit('add-node', {
    data: {
      id: sourceId,
      title: 'Source'
    }
  });

  fetchMovies(sourceUrl, function (movies) {
    socket.emit('progress', 'found movies');
    movies.map(function (m) {
      socket.emit('progress', 'analysing movie ' + m.movie_name);
      fetchActors(m.movie_url, function (actors) {
        socket.emit('progress', 'found actors');
        actors.map(function (a) {
          socket.emit('progress', 'analysing actor ' + a.actor_name);
          // add actor as a node
          socket.emit('add-node', {
            data: {
              id: a.id,
              title: a.actor_name
            }
          });
          // add the edge
          socket.emit('add-edge', {
            data: {
              source: sourceId,
              target: a.id
            }
          });
        });
      });
    });
  });
}



module.exports = app;
