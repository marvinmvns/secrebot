const express = require('express');
const path = require('path');
const { MongoClient, ObjectId } = require('mongodb');
const bodyParser = require('body-parser');
const methodOverride = require('method-override');
const expressLayouts = require('express-ejs-layouts');

const app = express();

// MongoDB connection details
const mongoUri = 'mongodb://admin:admin@192.168.31.71:27017/';
const dbName = 'sched'; // Atualizado para 'schedv2'
const collectionName = 'schedv2'; // Nome da coleção
let schedCollection;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(expressLayouts);

// Set up EJS as templating engine
app.set('view engine', 'ejs');

// Connect to MongoDB
MongoClient.connect(mongoUri, { useUnifiedTopology: true })
  .then(client => {
    console.log('Connected to MongoDB successfully.');
    const db = client.db(dbName);
    schedCollection = db.collection(collectionName);
  })
  .catch(err => {
    console.error('Error connecting to MongoDB:', err);
    process.exit(1);
  });

// Routes

// Home Page - List all messages
app.get('/', async (req, res) => {
  try {
    const messages = await schedCollection.find({}).toArray();
    res.render('index', { messages });
  } catch (err) {
    console.error('Error fetching messages:', err);
    res.status(500).send('Internal Server Error');
  }
});

// New Message Form
app.get('/messages/new', (req, res) => {
  res.render('new', { message: null }); // Passando 'message' como null
});

// Create New Message
app.post('/messages', async (req, res) => {
  const { recipient, message, scheduledTime, expiryTime } = req.body;
  try {


    await schedCollection.insertOne({
      recipient,
      message,
      status: 'approved',
      scheduledTime: new Date(scheduledTime),
      expiryTime: new Date(expiryTime),
      sentAt: null,
      attempts: 0,
      lastAttemptAt: null
    });
    res.redirect('/');
  } catch (err) {
    console.error('Error creating message:', err);
    res.status(500).send('Internal Server Error');
  }
});

// Edit Message Form
app.get('/messages/:id/edit', async (req, res) => {
  try {

    const message = await schedCollection.findOne({ _id: new ObjectId(req.params.id) });
    if (!message) {
      return res.status(404).send('Message not found');
    }
    res.render('edit', { message });
  } catch (err) {
    console.error('Error fetching message:', err);
    res.status(500).send('Internal Server Error');
  }
});

// Update Message
app.put('/messages/:id', async (req, res) => {
  const { recipient, message, scheduledTime, expiryTime, status } = req.body;
  try {


    await schedCollection.updateOne(
      { _id: new ObjectId(req.params.id) },
      {
        $set: {
          recipient,
          message,
          scheduledTime: new Date(scheduledTime),
          expiryTime: new Date(expiryTime),
          sentAt: null,
          status
        }
      }
    );
    res.redirect('/');
  } catch (err) {
    console.error('Error updating message:', err);
    res.status(500).send('Internal Server Error');
  }
});

// Delete Message
app.delete('/messages/:id', async (req, res) => {
  try {
    const result = await schedCollection.deleteOne({ _id: new ObjectId(req.params.id) });
    if (result.deletedCount === 0) {
      return res.status(404).send('Message not found');
    }
    res.redirect('/');
  } catch (err) {
    console.error('Error deleting message:', err);
    res.status(500).send('Internal Server Error');
  }
});

// Duplicate Message
app.post('/messages/:id/duplicate', async (req, res) => {
  console.log(`Received request to duplicate message ID: ${req.params.id}`);
  try {
    const originalMessage = await schedCollection.findOne({ _id: new ObjectId(req.params.id) });
    if (!originalMessage) {
      return res.status(404).send('Message not found');
    }

    // Cria uma cópia da mensagem original, excluindo _id
    const newMessage = {
      recipient: originalMessage.recipient,
      message: originalMessage.message,
      status: 'approved', // Define como 'approved' para torná-la ativa
      scheduledTime: originalMessage.scheduledTime,
      expiryTime: originalMessage.expiryTime,
      sentAt: null,
      attempts: 0,
      lastAttemptAt: null
    };

    await schedCollection.insertOne(newMessage);
    console.log(`Duplicated message ID: ${originalMessage._id} to new message.`);
    res.redirect('/');
  } catch (err) {
    console.error('Error duplicating message:', err);
    res.status(500).send('Internal Server Error');
  }
});

// Start the server
const PORT = 3003;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
