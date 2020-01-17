import * as mongoose from 'mongoose';

// TODO finalize sources schema
let SnapshotSchema = new mongoose.Schema({
    parameters: String,
});

SnapshotSchema.index({ '$**': 'text' });

let Snapshot = mongoose.model('Snapshots', SnapshotSchema);
module.exports = Snapshot;
