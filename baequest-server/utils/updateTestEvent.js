require('dotenv').config();
const mongoose = require('mongoose');
const event = require('../models/event');

async function updateTestEvent() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/baequest');
    console.log('Connected to MongoDB');

    // Create new start and end times
    const startTime = new Date();
    const endTime = new Date(startTime);
    endTime.setHours(endTime.getHours() + 3);

    // Update the test event
    const result = await event.findOneAndUpdate(
      { title: 'Test Meetup in Arlington' },
      {
        date: startTime,
        endTime: endTime,
        location: {
          lat: 38.90370854165833,
          lng: -77.05048085608769
        }
      },
      { new: true }
    );

    if (result) {
      console.log('Test event updated successfully!');
      console.log('New start time:', result.date.toISOString());
      console.log('New end time:', result.endTime.toISOString());
    } else {
      console.log('Test event not found');
    }

    await mongoose.connection.close();
    console.log('Database connection closed');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

updateTestEvent();
