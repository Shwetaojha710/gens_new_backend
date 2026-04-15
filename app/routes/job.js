const express = require('express');
const router = express.Router();
const {Admin,WebcamAdmin} = require('../middleware/auth');
const upload = require('../middleware/upload');
const { createJobRequirement, deleteJobRequirement, getJobRequirements, getSkills, updateJobRequirement, publishJob } = require('../controller/recruitment/job');

router.post('/createJobRequirement', Admin, createJobRequirement);
router.post('/updateJobRequirement', Admin, updateJobRequirement);
router.post('/deleteJobRequirement', Admin,deleteJobRequirement);
router.post('/getJobRequirements', Admin, getJobRequirements);
router.post('/publishJob', Admin, publishJob);
router.post('/get-skills', Admin, getSkills);

module.exports=router;