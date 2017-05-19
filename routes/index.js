var express = require('express');
var router = express.Router();
const request = require('tinyreq');
const cheerio = require('cheerio');
const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const base = "http://www.imdb.com";

var Graph = require("graphlib").Graph;
var g = new Graph();

function getId(url) {
  var parts = url.split('/');
  for (var i = 0; i < parts.length; i++) {
    var part = parts[i].substring(0, 2);
    if (part === "tt" || part === "nm") { return parts[i]; }
  }
  return '';
}

function fetchActors(movieUrl) {
  request(movieUrl, function (err, body) {
    var $ = cheerio.load(body);
    var actorList = $(".itemprop", ".cast_list");
    actorList.map(function (i) {
      var actorName = $(".itemprop[itemprop='name']", actorList[i]).text();
      var actorUrl = base + $("a", actorList[i]).attr('href');
      if (actorName && actorUrl) {
        console.log(actorName + '(' + getId(actorUrl) + ') - ' + actorUrl);
      }
    });
  });
}

function fetchMovies(actorUrl) {
  request(actorUrl, function (err, body) {
    var $ = cheerio.load(body);
    var movieListContainer = $(".filmo-category-section").first();
    var movieList = $(".filmo-row", movieListContainer);
    movieList.map(function (i) {
      var movieName = $("a", "b", movieList[i]).text();
      var movieUrl = base + $("a", "b", movieList[i]).attr('href');
      if (movieName && movieUrl) {
        console.log(movieName + '(' + getId(movieUrl) + ') - ' + movieUrl);
      }
    });
  });
}

router.get('/', function (req, res, next) {
  if (req && req.query && req.query.url) {
    // do the thing with url
    res.render('index', {
      results: {
        test: 'loaded'
      }
    });
  }
  else {
    res.render('index', {
      results: null
    });
  }
});

module.exports = router;
