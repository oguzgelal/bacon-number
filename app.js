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

var socket;
var server = require('http').createServer(app);
var io = require('socket.io')(server);
io.on('connection', function (sck) {
  console.log('> client connected!');
  socket = sck;

  sck.on('search', function (data) {
    findBaconNumber(data.target_url, data.source_url);
  });


});
server.listen(3001);


const base = "http://www.imdb.com";
var visitedNodes = [];
var targetActorId, sourceActorId;
var targetActorUrl, sourceActorUrl;
var fetchLimit = 50, fetchCount = 0;
var path;

function getId(url) {
  var parts = url.split('/');
  for (var i = 0; i < parts.length; i++) {
    var part = parts[i].substring(0, 2);
    if (part === "tt" || part === "nm") { return parts[i]; }
  }
  return '';
}

function getRandomLoc() {
  var min = -500;
  var max = 500;
  return Math.floor(Math.random() * (max - min)) + min;
}

function isVisited(id) {
  return visitedNodes.indexOf(id) !== -1;
}

function fetchActors(movie, callback) {
  console.log('> fetching actors');
  // if visited before, dont visit again and return empty
  if (isVisited(movie.id)) { console.log('> visited before'); return []; }
  var x = [];
  request(movie.url, function (err, body) {
    visitedNodes.push(movie.id);
    var $ = cheerio.load(body);
    var actorList = $(".itemprop", ".cast_list");
    actorList.map(function (i) {
      var actorName = $(".itemprop[itemprop='name']", actorList[i]).text();
      var actorUrl = base + $("a", actorList[i]).attr('href');
      if (actorName && actorUrl) {
        var data = {
          id: getId(actorUrl),
          name: actorName,
          url: actorUrl,
          type: 'actor'
        };
        var dataNode = {
          id: getId(actorUrl),
          group: 'nodes',
          data: data,
          position: { x: getRandomLoc(), y: getRandomLoc() }
        };
        var dataEdge = {
          group: 'edges',
          data: {
            source: movie.id,
            target: getId(actorUrl)
          }
        };

        // TODO: suppress error
        cy.add(dataNode);
        socket.emit('add-node', dataNode);
        cy.add(dataEdge);
        socket.emit('add-node', dataEdge);

        x.push(data);
      }
    });
    callback(x);
  });
}

function fetchMovies(actor, callback) {
  console.log('> fetching movies');
  // if visited before, dont visit again and return empty
  if (isVisited(actor.id)) { console.log('> visited before'); return []; }
  var x = [];
  request(actor.url, function (err, body) {
    visitedNodes.push(actor.id);
    var $ = cheerio.load(body);
    var movieListContainer = $(".filmo-category-section").first();
    var movieList = $(".filmo-row", movieListContainer);
    movieList.map(function (i) {
      var movieName = $("a", "b", movieList[i]).text();
      var movieUrl = base + $("a", "b", movieList[i]).attr('href');
      if (movieName && movieUrl) {
        var data = {
          id: getId(movieUrl),
          name: movieName,
          url: movieUrl,
          type: 'movie'
        };
        var dataNode = {
          group: 'nodes',
          data: data,
          id: getId(movieUrl),
          position: { x: getRandomLoc(), y: getRandomLoc() }
        }
        var dataEdge = {
          group: 'edges',
          data: {
            source: actor.id,
            target: getId(movieUrl)
          }
        };

        // TODO: suppress error
        cy.add(dataNode);
        socket.emit('add-node', dataNode);
        cy.add(dataEdge);
        socket.emit('add-node', dataEdge);

        x.push(data);
      }
    });
    callback(x);
  });
}

function isBaconNumberFound() {
  var res = cy.elements().aStar({ root: '#' + sourceActorId, goal: '#' + targetActorId });
  console.log(res);
  return res && res.found;
}

function findBaconNumber(tActorUrl, sActorUrl) {
  var result = null;
  targetActorUrl = tActorUrl;
  sourceActorUrl = sActorUrl;
  targetActorId = getId(targetActorUrl);
  sourceActorId = getId(sourceActorUrl);

  var targetData = {
    id: targetActorId,
    data: {
      id: targetActorId,
      name: 'Target',
      type: 'actor',
    }
  };

  var sourceData = {
    id: sourceActorId,
    data: {
      id: sourceActorId,
      name: 'Source',
      type: 'actor'
    }
  };

  cy.add(targetData);
  cy.add(sourceData);
  socket.emit('add-node', targetData);
  socket.emit('add-node', sourceData);

  findRecursive([], [], fetchCount, fetchLimit, function () {
    console.log('done!');
  });
}

function checkActorFound(actorQueue) {
  var ind = actorQueue.map(function (i) { return i.id; }).indexOf(targetActorId);
  if (ind !== -1) {
  }
}

function findRecursive(movieQueue, actorQueue, fetchCount, fetchLimit, callback) {
  console.log('> running');

  // movie queue
  if (movieQueue.length > 0) {
    var fetchMovie = movieQueue.shift();
    if (!isVisited(fetchMovie.id)) {
      if (fetchCount <= fetchLimit) {
        fetchActors(fetchMovie, function (actors) {
          actorQueue = actorQueue.concat(actors);
          fetchCount += 1;
          if (isBaconNumberFound()) {
            console.log('bingo');
            callback();
            return;
          }
          else { findRecursive(movieQueue, actorQueue, fetchCount, fetchLimit, callback); }
        });
      } else { callback(); }
    } else { findRecursive(movieQueue, actorQueue, fetchCount, fetchLimit, callback); }
  }

  // actor queue
  else if (actorQueue.length > 0) {
    var fetchActor = actorQueue.shift();
    if (!isVisited(fetchActor.id)) {
      fetchMovies(fetchActor, function (movies) {
        movieQueue = movieQueue.concat(movies);
        fetchCount += 1;
        if (fetchCount <= fetchLimit) { findRecursive(movieQueue, actorQueue, fetchCount, fetchLimit, callback); }
        else { callback(); }
      }, fetchActor.id);
    } else { findRecursive(movieQueue, actorQueue, fetchCount, fetchLimit, callback); }
  }

  // first fetch
  else {
    fetchMovies({ id: sourceActorId, url: sourceActorUrl }, function (movies) {
      movieQueue = movieQueue.concat(movies);
      fetchCount += 1;
      if (fetchCount <= fetchLimit) { findRecursive(movieQueue, actorQueue, fetchCount, fetchLimit, callback); }
      else { callback(); }
    });
  }

}



module.exports = app;
