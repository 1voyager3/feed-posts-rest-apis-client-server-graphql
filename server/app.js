const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
// to be able parse incoming request bodies
const bodyParser = require('body-parser');
const multer = require('multer');
const { graphqlHTTP } = require('express-graphql');
const graphqlSchema = require('./graphql/schema');
const graphqlResolver = require('./graphql/resolvers');
const auth = require('./middleware/auth');
const { clearImage } = require('./util/file');

// execution express
const app = express();

const fileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'images');
  },
  filename: (req, file, cb) => {
    cb(null, `${new Date().toISOString()}-${file.originalname}`);
  }
});
const fileFilter = (req, file, cb) => {
  if (
      file.mimetype === 'image/png' ||
      file.mimetype === 'image/jpg' ||
      file.mimetype === 'image/jpeg'
  ) {
    cb(null, true);
  } else {
    cb(null, false);
  }
};

// it used for x-www-form-urlencoded request for the <form>
// app.use(bodyParser.urlencoded());

// it used for parsing json data incoming requests
// Content-Type: application/json;
app.use(bodyParser.json());

app.use(
    multer({
      storage: fileStorage,
      fileFilter: fileFilter
    })
        .single('image')
);

app.use('/images', express.static(path.join(__dirname, 'images')));

// to provide access to the Client/browser to avoid CORS errors
// value "*" allows access to any browsers or set particular domain
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // in case of 405 Method Not Allowed
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  // call next the request to be able to continue and use next middleware in our case:
  // app.use('/feed', feedRoutes);
  next();
});

// authentication
app.use(auth);

// setting up images
app.put('/post-image', (req, res, next) => {

  if (!req.isAuth) {
    throw new Error('Not authenticated!');
  }

  if (!req.file) {
    return res.status(200)
        .json({ message: 'No file provided!' });
  }

  if (req.body.oldPath) {
    clearImage(req.body.oldPath);
  }

  return res
      .status(201)
      .json({
        message: 'File stored',
        filePath: req.file.path
      });

});

// route through graphql
app.use('/graphql', graphqlHTTP({
  schema: graphqlSchema,
  rootValue: graphqlResolver,
  graphiql: true,
  customFormatErrorFn (err) {
    if (!err.originalError) {
      return err;
    }

    const data = err.originalError.data;
    const message = err.message || 'An error occurred.';
    const code = err.originalError.code || 500;

    return {
      message: message,
      status: code,
      data: data
    };
  }
}));

// registration error middleware
app.use((error, req, res, next) => {
  console.log(error);
  const status = error.statusCode || 500;
  const message = error.message;

  const data = error.data;
  res.status(status)
      .json({ message: message, data: data });

});

// initializing database
mongoose
    .connect(
        // put appropriate mongodb url
        ''
    )
    .then(() => {
      app.listen(8080);

      console.log('Server CONNECTED!');
    })
    .catch(err => {
      console.log(err);
    });


