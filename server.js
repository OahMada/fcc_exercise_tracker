const express = require('express')
const app = express()
const bodyParser = require('body-parser')
const shortId= require('shortid');

const cors = require('cors')

const mongoose = require('mongoose')
// mongoose.connect(process.env.MLAB_URI || 'mongodb://localhost/exercise-track' )
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true });

app.use(cors())

app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())


app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

// exercise tracker

const Schema = mongoose.Schema;
const LogSchema = new Schema({
  description: {type: String, required: true},
  duration: {type: Number, required: true},
  date: Date,
  _id: false
});

const UserSchema = new Schema({
  _id: {type: String, default: shortId.generate},
  username: String,
  count: {type: Number, default: 0},
  exerciseLog: [{type: LogSchema, default: []}]
});

const User = mongoose.model('User', UserSchema);
// const Log = mongoose.model('Log', LogSchema);


// submit new user
app.post('/api/exercise/new-user', function(req, res, next) {
  // validate username not taken
  User.findOne({username: req.body.username}, function(err, user){
    if(err) {
      next(err);
    } else {
      if(!user){
        res.user = req.body.username;
        next();
      } else {
        res.json({error: 'Username already taken'});
      }
    }
  });
},function(req, res, next) {
  // save new user to database
  const user = new User({username: res.user});
  user.save(function(err, user){
    if(err) {
      next(err);
    } else {
      res.json({_id: user._id, username: user.username});
    }
  })
});

// list all users
app.get('/api/exercise/users', function(req, res, next) {
  User.find({}, 'username', function(err, docs){
    if(err) {
      next(err);
    } else {
      res.send(docs);
    }
  })
});

// submit exercise log
app.post('/api/exercise/add', function(req, res, next) {
  const id = req.body.userId,
        desc = req.body.description,
        duration = req.body.duration;

  let date = req.body.date;
  if(!date) {
    date = new Date();
  } else {
    date = new Date(date);
    date.setHours(8, 0, 0, 0);
  }

  const logToSub = {
      description: desc,
      duration: duration,
      date: date
    };
  // User.findByIdAndUpdate(id, {$push: {exerciseLog: log}, $inc: {count: 1}}, {new: true}, function(err, doc) {
  //   if(err) {
  //     const keys = Object.keys(err.errors);
  //     res.send(err.errors[keys[0]].message); console.log(err.errors[keys[0]].message);
  //   }
  //   res.json({_id: doc._id,
  //             username: doc.username,
  //             description: desc,
  //             duration: duration,
  //             date: date.toDateString()
  //            });
  // });
  User.findById(id, function(err, user){
    if(user) {
      user.count += 1;
      user.exerciseLog.push(logToSub);
      user.save(function(err, doc) {
        if(err) {
          next(err);
        }
        else {
          res.json({_id: user._id,
                  username: user.username,
                  description: desc,
                  duration: duration,
                  date: date.toDateString()
                 });
        }
      });
    } else {
      res.json({error: 'Unknown userId'});
    }
  });
});


// log query
app.get('/api/exercise/log', function(req, res, next) {
  const id = req.query.userId,
        limit = req.query.limit;

  let from = req.query.from,
        to = req.query.to;

  User.findById(id, '-__v', function(err, doc) {
    if(doc) {
      if(from || to) {
        if(from) {
          from = new Date(from);
        }
        if(to) {
          to = new Date(to);
          to.setHours(23, 59, 59);
        }
        doc.exerciseLog = doc.exerciseLog.filter(item => {
          return from ? item.date.getTime() >= from.getTime() : true;
        });

        doc.exerciseLog = doc.exerciseLog.filter(item => {
          return to ? item.date.getTime() <= to.getTime() : true;
        });

      }
      const docObj = doc.toObject();

      docObj.exerciseLog.map(item => {
        item.date = item.date.toDateString();
      });

      if(limit) {
        docObj.exerciseLog = docObj.exerciseLog.slice(0, limit);
      }

      res.json(docObj);
    } else {
      res.json({error: 'Unknown userId'});
    }
  });
});

// Not found middleware
app.use((req, res, next) => {
  return next({status: 404, message: 'not found'})
})

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage

  if (err.errors) {
    // mongoose validation error
    errCode = 400 // bad request
    const keys = Object.keys(err.errors)
    // report the first validation error
    errMessage = err.errors[keys[0]].message
  } else {
    // generic or custom error
    errCode = err.status || 500
    errMessage = err.message || 'Internal Server Error'
  }
  res.status(errCode).type('txt')
    .send(errMessage)
});

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
});
