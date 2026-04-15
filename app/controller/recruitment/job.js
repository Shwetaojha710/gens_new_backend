const JobRequirement = require("../../models/job_requirement");
const Helper = require("../../helper/helper.js");
const sequelize = require("../../connection/connection.js");
const Department = require("../../models/department.js");
const Skills = require("../../models/skills.js");
const EmploymentType = require("../../models/employmentType.js");

const { v4: uuidv4 } = require("uuid");
const job_requirement = require("../../models/job_requirement");
const interview_round = require("../../models/interview_round.js");
const { application } = require("express");
const Application = require("../../models/application.js");

const normalizeCandidatePreference = (value) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const normalizedValue = String(value).trim().toLowerCase();
  const allowedValues = ["male", "female", "both"];

  return allowedValues.includes(normalizedValue) ? normalizedValue : null;
};

const normalizeInterviewRounds = (interview_round_ids, interview_rounds) => {
  const roundsValue =
    interview_round_ids !== undefined ? interview_round_ids : interview_rounds;

  if (roundsValue === undefined || roundsValue === null) {
    return undefined;
  }

  if (!Array.isArray(roundsValue)) {
    return null;
  }

  return roundsValue;
};

exports.createJobRequirement = async (req, res) => {
  try {
    const {
      job_title,
      department,
      skills,
      experience,
      budget_ctc,
      notice_period,
      job_description,
      emp_type,
      emp_length,
      mode,
      location,
      designation,
      no_of_opening,
      qualification,
      interview_round_ids,
      interview_rounds,
      candidate_preference,
    } = req.body;

    const tenantId = req.users?.tenantId;
    const branchId = req.users?.branchId;
    const userId = req.users?.id;

    if (!job_title || !department || !job_description) {
      return Helper.response(false, "Required fields missing", {}, res, 400);
    }

    const normalizedCandidatePreference =
      normalizeCandidatePreference(candidate_preference);

    if (normalizedCandidatePreference === null) {
      return Helper.response(
        false,
        "candidate_preference must be male, female, or both",
        {},
        res,
        400,
      );
    }

    const normalizedInterviewRounds = normalizeInterviewRounds(
      interview_round_ids,
      interview_rounds,
    );

    if (normalizedInterviewRounds === null) {
      return Helper.response(
        false,
        "interview_round_ids must be an array",
        {},
        res,
        400,
      );
    }

    const base_url = process.env.CAN_BASE_URL;

    const slug = job_title
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");

    const token = uuidv4();

    const job = await JobRequirement.create({
      tenantId,
      branchId,
      job_title,
      department,
      skills,
      experience,
      budget_ctc,
      notice_period,
      job_description,
      emp_type,
      emp_length,
      mode,
      slug,
      location,
      no_of_opening,
      designation,
      qualification,
      candidate_preference: normalizedCandidatePreference ?? "both",
      interview_round: normalizedInterviewRounds ?? null,
      createdBy: userId,
    });

    const jobCode = `JOB${String(job.id).padStart(4, "0")}`;

    const url = `${base_url}/${slug}?job_id=${job.id}&token=${token}`;

    await job.update({
      job_id: jobCode,
      url,
      token,
    });

    return Helper.response(true, "Created Successfully", job, res, 200);
  } catch (error) {
    console.error(error);
    return Helper.response(false, error.message, {}, res, 500);
  }
};

exports.deleteJobRequirement = async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) {
      return Helper.response(false, "Id is required", {}, res, 400);
    }

    const job = await JobRequirement.findOne({ where: { id } });

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job Requirement not found",
      });
    }

    await job.destroy();

    return Helper.response(
      true,
      "Job Requirement deleted successfully",
      job,
      res,
      200,
    );
  } catch (error) {
    console.error(error);
    return Helper.response(true, error.message, {}, res, 500);
  }
};

exports.getJobRequirements = async (req, res) => {
  try {
    const tenantId = req.users?.tenantId;
    const branchId = req.users?.branchId;
    const { department, skills, status } = req.body;
    let whereCondition = {
      tenantId,
      branchId,

    };
    if (department) {
      whereCondition.department = department;
    }
    if (skills) {
      whereCondition.skills = skills;
    }
    if (status) {
      whereCondition.status = status;
    }

    const jobs = await JobRequirement.findAll({
      where: whereCondition,
      include: [
        {
          model: Department,
          as: "departmentData",
          attributes: ["id", "name"],
        },
        {
          model: EmploymentType,
          as: "emp_typeData",
          attributes: ["id", "name"],
        },
         {
          model: Application,
          as: "applications",
          attributes: ["id"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });
    if (jobs.length == 0) {
      return Helper.response(false, "No Data Found", {}, res, 200);
    }

    const allInterviewRoundIds = [
      ...new Set(
        jobs.flatMap((job) =>
          Array.isArray(job.interview_round) ? job.interview_round : [],
        ),
      ),
    ];

    let interviewRoundMap = new Map();

    if (allInterviewRoundIds.length > 0) {
      const interviewRounds = await interview_round.findAll({
        where: {
          id: allInterviewRoundIds,
          tenantId,
          branchId,
        },
        include: [
          {
            model: require("../../models/round_type"),
            as: "roundTypeData",
            attributes: ["id", "name"],
          },
        ],
      });

      interviewRoundMap = new Map(
        interviewRounds.map((round) => [round.id, round.toJSON()]),
      );
    }

    const jobsWithInterviewRounds = jobs.map((job) => {
      const jobData = job.toJSON();
      const interviewRoundIds = Array.isArray(jobData.interview_round)
        ? jobData.interview_round
        : [];

      jobData.interview_round_data = interviewRoundIds
        .map((roundId) => interviewRoundMap.get(roundId))
        .filter(Boolean);

      jobData.application_count = Array.isArray(jobData.applications)
        ? jobData.applications.length
        : 0;

      return jobData;
    });

    return Helper.response(
      true,
      "Data Found Successfully",
      jobsWithInterviewRounds,
      res,
      200,
    );
  } catch (error) {
    return Helper.response(false, error.message, {}, res, 500);
  }
};

exports.getSkills = async (req, res) => {
  try {
    const data = await Skills.findAll({
      raw: true,
      order: [["createdAt", "desc"]],
    });

    if (data.length == 0) {
      return Helper.response(false, "No Data Found", {}, res, 400);
    }

    return Helper.response(true, "Data Found Successfully", data, res, 200);
  } catch (error) {
    return Helper.response(false, error.message, {}, res, 500);
  }
};

exports.updateJobRequirement = async (req, res) => {
  try {
    const {
      id,
      job_title,
      department,
      skills,
      experience,
      budget_ctc,
      notice_period,
      job_description,
      emp_type,
      emp_length,
      mode,
      location,
      designation,
      no_of_opening,
      interview_round_ids,
      interview_rounds,
      candidate_preference,
      qualification,
    } = req.body;

    const tenantId = req.users?.tenantId;
    const branchId = req.users?.branchId;
    const userId = req.users?.id;

    if (!id) {
      return Helper.response(
        false,
        "JobRequirement ID is required",
        {},
        res,
        400,
      );
    }

    const normalizedCandidatePreference =
      normalizeCandidatePreference(candidate_preference);

    if (normalizedCandidatePreference === null) {
      return Helper.response(
        false,
        "candidate_preference must be male, female, or both",
        {},
        res,
        400,
      );
    }

    const normalizedInterviewRounds = normalizeInterviewRounds(
      interview_round_ids,
      interview_rounds,
    );

    if (normalizedInterviewRounds === null) {
      return Helper.response(
        false,
        "interview_round_ids must be an array",
        {},
        res,
        400,
      );
    }

    const job = await JobRequirement.findOne({
      where: { id, tenantId ,branchId},
    });

    if (!job) {
      return Helper.response(false, "Job not found", {}, res, 404);
    }

    const pick = (newVal, existing) =>
      newVal !== undefined && newVal !== null && newVal !== "" ? newVal : existing;

    await job.update({
      job_title: pick(job_title, job.job_title),
      department: pick(department, job.department),
      skills: pick(skills, job.skills),
      experience: pick(experience, job.experience),
      budget_ctc: pick(budget_ctc, job.budget_ctc),
      notice_period: pick(notice_period, job.notice_period),
      job_description: pick(job_description, job.job_description),
      emp_type: pick(emp_type, job.emp_type),
      emp_length: pick(emp_length, job.emp_length),
      mode: pick(mode, job.mode),
      location: pick(location, job.location),
      designation: pick(designation, job.designation),
      no_of_opening: no_of_opening ?? job.no_of_opening,
      qualification: pick(qualification, job.qualification),
      candidate_preference: normalizedCandidatePreference ?? job.candidate_preference,
      interview_round: normalizedInterviewRounds ?? job.interview_round,
      updatedBy: userId,
    });

    return Helper.response(true, "Updated Successfully", job, res, 200);
  } catch (error) {
    console.error(error);
    return Helper.response(false, error.message, {}, res, 500);
  }
};

exports.publishJob = async (req, res) => {
  try {
    const { id, status } = req.body;

    if (!id) {
      return Helper.response(false, "Id is required", {}, res, 400);
    }

    const updateJob = await job_requirement.update(
      {
        status,
      },
      {
        where: {
          id: id,
        },
      },
    );

    return Helper.response(true, "Data Updated Successfully", {}, res, 200);
  } catch (error) {
    console.error(error);
    return Helper.response(false, error.message, {}, res, 500);
  }
};
