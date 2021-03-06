// https://www.kaggle.com/rounakbanik/the-movies-dataset/data
// Exercise: Content-based - Include credits data with crew and cast too
// Exercise: Content-based - Make features weighted based on popularity or actors
// Exercise: Collaborative Filtering - Model-based CF with SVD
import express from 'express';
import path from 'path';
import bodyParser from 'body-parser';
import compress from 'compression';
import appRoot from 'app-root-path';
import morgan from 'morgan';
import fs from 'fs';
import csv from 'fast-csv';

import router from './routes/index.route';
import prepareRatings from './preparation/ratings';
import prepareMovies from './preparation/movies';
import predictWithLinearRegression from './strategies/linearRegression';
import predictWithContentBased from './strategies/contentBased';
import { predictWithCfUserBased, predictWithCfItemBased } from './strategies/collaborativeFiltering';
import { getMovieIndexByTitle } from './strategies/common';

let MOVIES_META_DATA = {};
let MOVIES_KEYWORDS = {};
let RATINGS = [];

let ME_USER_ID = 0;

let moviesMetaDataPromise = new Promise((resolve) =>
  fs
    .createReadStream('./data/movies_metadata.csv')
    .pipe(csv({ headers: true }))
    .on('data', fromMetaDataFile)
    .on('end', () => resolve(MOVIES_META_DATA)));

let moviesKeywordsPromise = new Promise((resolve) =>
  fs
    .createReadStream('./data/keywords.csv')
    .pipe(csv({ headers: true }))
    .on('data', fromKeywordsFile)
    .on('end', () => resolve(MOVIES_KEYWORDS)));

let ratingsPromise = new Promise((resolve) =>
  fs
    .createReadStream('./data/ratings_small.csv')
    .pipe(csv({ headers: true }))
    .on('data', fromRatingsFile)
    .on('end', () => resolve(RATINGS)));

function fromMetaDataFile(row) {
  MOVIES_META_DATA[row.id] = {
    id: row.id,
    adult: row.adult,
    budget: row.budget,
    genres: softEval(row.genres, []),
    homepage: row.homepage,
    language: row.original_language,
    title: row.original_title,
    overview: row.overview,
    popularity: row.popularity,
    studio: softEval(row.production_companies, []),
    release: row.release_date,
    revenue: row.revenue,
    runtime: row.runtime,
    voteAverage: row.vote_average,
    voteCount: row.vote_count
  };
}

function fromKeywordsFile(row) {
  MOVIES_KEYWORDS[row.id] = {
    keywords: softEval(row.keywords, []),
  };
}

function fromRatingsFile(row) {
  RATINGS.push(row);
}

console.log('Unloading data from files ... \n');

Promise.all([
  moviesMetaDataPromise,
  moviesKeywordsPromise,
  ratingsPromise,
]).then(init);

function init([ moviesMetaData, moviesKeywords, ratings ]) {
  /* ------------ */
  //  Preparation //
  /* -------------*/

  const {
    MOVIES_BY_ID,
    MOVIES_IN_LIST,
    X,
  } = prepareMovies(moviesMetaData, moviesKeywords);

  global.movies_by_id = MOVIES_BY_ID;
  global.movies_in_list = MOVIES_IN_LIST;
  global.matrix = X;

  let ME_USER_RATINGS = [
    addUserRating(ME_USER_ID, 'Doctor Strange', '5.0', MOVIES_IN_LIST),
    addUserRating(ME_USER_ID, 'Thor', '4.0', MOVIES_IN_LIST),
    addUserRating(ME_USER_ID, 'Back to the Future Part II', '3.0', MOVIES_IN_LIST),
    addUserRating(ME_USER_ID, 'Jurassic Park', '4.0', MOVIES_IN_LIST),
    addUserRating(ME_USER_ID, 'Reservoir Dogs', '1.0', MOVIES_IN_LIST),
    addUserRating(ME_USER_ID, 'Men in Black II', '3.0', MOVIES_IN_LIST),
    addUserRating(ME_USER_ID, 'Captain America: The First Avenger', '5.0', MOVIES_IN_LIST),
    addUserRating(ME_USER_ID, 'Sissi', '1.0', MOVIES_IN_LIST),
    addUserRating(ME_USER_ID, 'Titanic', '1.0', MOVIES_IN_LIST),
  ];

  const {
    ratingsGroupedByUser,
    ratingsGroupedByMovie,
  } = prepareRatings([ ...ME_USER_RATINGS, ...ratings ]);

  global._ratingsGroupedByUser = ratingsGroupedByUser;
  global._ratingsGroupedByMovie = ratingsGroupedByUser;

/* Init variable */
var app = express();
var port = process.env.port || 5050;
/* Init variable */

/* Utility package */
// app.use(logger('dev'));
app.use(morgan('dev'));
app.use(bodyParser.urlencoded({ extended: true } ));
app.use(bodyParser.json());
app.use(compress());
/* Utility package */
app.use(function (req, res, next) {

  // Website you wish to allow to connect
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:4200');
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5000');
  // Request methods you wish to allow
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');

  // Request headers you wish to allow
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');

  // Set to true if you need the website to include cookies in the requests sent
  // to the API (e.g. in case you use sessions)
  res.setHeader('Access-Control-Allow-Credentials', true);

  // Pass to next layer of middleware
  next();
});
/* Routes */
app.use('/api', router);
/* Routes */

/* dev */
// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});
// start server on port 5050
app.listen(port, function() {
    console.log('server is running on:' + port);
});

  /* ----------------------------- */
  //  Linear Regression Prediction //
  //        Gradient Descent       //
  /* ----------------------------- */

  /* console.log('\n');
  console.log('(A) Linear Regression Prediction ... \n');

  console.log('(1) Training \n');
  const meUserRatings = _ratingsGroupedByUser[ME_USER_ID];
  console.log(meUserRatings);
  const linearRegressionBasedRecommendation = predictWithLinearRegression(matrix, movies_in_list, meUserRatings);

  console.log('(2) Prediction \n');
  console.log(sliceAndDice(linearRegressionBasedRecommendation, movies_by_id, 10, true)); */

  /* ------------------------- */
  //  Content-Based Prediction //
  //  Cosine Similarity Matrix //
  /* ------------------------- */

/*   console.log('\n');
  console.log('(B) Content-Based Prediction ... \n');

  console.log('(1) Computing Cosine Similarity \n');
  const title = 'Batman Begins';
  const contentBasedRecommendation = predictWithContentBased(X, MOVIES_IN_LIST, title);

  console.log(`(2) Prediction based on "${title}" \n`);
  console.log(sliceAndDice(contentBasedRecommendation, MOVIES_BY_ID, 10, true)); */

  /* ----------------------------------- */
  //  Collaborative-Filtering Prediction //
  //             User-Based              //
  /* ----------------------------------- */

  /* console.log('\n');
  console.log('(C) Collaborative-Filtering (User-Based) Prediction ... \n');

  console.log('(1) Computing User-Based Cosine Similarity \n');

  const cfUserBasedRecommendation = predictWithCfUserBased(
    ratingsGroupedByUser,
    ratingsGroupedByMovie,
    ME_USER_ID
  );

  console.log('(2) Prediction \n');
  console.log(sliceAndDice(cfUserBasedRecommendation, MOVIES_BY_ID, 10, true)); */

  /* ----------------------------------- */
  //  Collaborative-Filtering Prediction //
  //             Item-Based              //
  /* ----------------------------------- */

  /* console.log('\n');
  console.log('(C) Collaborative-Filtering (Item-Based) Prediction ... \n');

  console.log('(1) Computing Item-Based Cosine Similarity \n');

  const cfItemBasedRecommendation = predictWithCfItemBased(
    ratingsGroupedByUser,
    ratingsGroupedByMovie,
    ME_USER_ID
  );

  console.log('(2) Prediction \n');
  console.log(sliceAndDice(cfItemBasedRecommendation, MOVIES_BY_ID, 10, true));

  console.log('\n');
  console.log('End ...'); */
  
}

// Utility

export function addUserRating(userId, searchTitle, rating, MOVIES_IN_LIST) {
  const { id, title } = getMovieIndexByTitle(MOVIES_IN_LIST, searchTitle);

  return {
    userId,
    rating,
    movieId: id,
    title,
  };
}

export function sliceAndDice(recommendations, MOVIES_BY_ID, count, onlyTitle) {
  recommendations = recommendations.filter(recommendation => MOVIES_BY_ID[recommendation.movieId]);

  recommendations = onlyTitle
    ? recommendations.map(mr => ({ id: mr.movieId, title: MOVIES_BY_ID[mr.movieId].title, score: mr.score }))
    : recommendations.map(mr => ({ id: mr.movieId, movie: MOVIES_BY_ID[mr.movieId], score: mr.score }));

  return recommendations
    .slice(0, count);
}

export function softEval(string, escape) {
  if (!string) {
    return escape;
  }

  try {
    return eval(string);
  } catch (e) {
    return escape;
  }
}

/* export default {
    addUserRating,
    sliceAndDice,
    softEval
} */