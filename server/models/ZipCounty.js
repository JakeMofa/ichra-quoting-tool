// Schema model Zipcounty 
const mongoose = require('mongoose');

const zipCountySchema = new mongoose.Schema({
  zip_code: String,
  county_id: String,
});

module.exports = mongoose.model('ZipCounty', zipCountySchema);
