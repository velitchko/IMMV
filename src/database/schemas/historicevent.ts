import * as mongoose from 'mongoose';

let HistoricEventSchema = new mongoose.Schema({
  name: String,
  status: {
    type: String,
    default: 'OFFLINE'
  }, // ONLINE / OFFLINE
  author: String, // person editing / creating this
  startDate: String,
  endDate: String,
  eventDescriptiveType: String,
  eventStructuralType: String,

  abstract: String,
  description: String,

  identifiers: [{
    url: String,
    title: String,
    copyright: String,
    identifierType: String
  }],

  dates: [{
    startDate: String,
    endDate: String,
    dateName: String
  }],

  historicEvents: [{
    historicEvent : {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'HistoricEvents'
    },
    relationship: String
  }]
});

// make all text fields (string) indexable
// allows for fulltext (partial string matching) querying
HistoricEventSchema.index({'$**': 'text'});

let HistoricEvent = mongoose.model('HistoricEvents', HistoricEventSchema);
module.exports = HistoricEvent;
