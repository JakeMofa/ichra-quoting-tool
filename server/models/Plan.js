//server/models/Plan.js
const mongoose = require('mongoose');

const planSchema = new mongoose.Schema(
  {
    carrier_name: String,
    display_name: String,
    effective_date: Date,
    expiration_date: Date,
    name: String,
    plan_type: String,
    service_area_id: String,
    source: String,
    type: String,

    adult_dental: Boolean,
    age29_rider: Boolean,
    ambulance: String,
    benefits_summary_url: String,
    buy_link: String,
    child_dental: String,
    child_eyewear: String,
    child_eye_exam: String,
    customer_service_phone_number: String,
    durable_medical_equipment: String,
    diagnostic_test: String,
    dp_rider: Boolean,
    drug_formulary_url: String,
    emergency_room: String,

    family_drug_deductible: String,
    family_drug_moop: String,
    family_medical_deductible: String,
    family_medical_moop: String,

    fp_rider: Boolean,
    generic_drugs: String,
    habilitation_services: String,
    hios_issuer_id: String,
    home_health_care: String,
    hospice_service: String,
    hsa_eligible: Boolean,

    plan_id: { type: String, required: true, unique: true }, // plan_id
    imaging: String,

    individual_drug_deductible: String,
    individual_drug_moop: String,
    individual_medical_deductible: String,
    individual_medical_moop: String,

    inpatient_birth: String,
    inpatient_facility: String,
    inpatient_mental_health: String,
    inpatient_physician: String,
    inpatient_substance: String,

    level: String,
    logo_url: String,
    non_preferred_brand_drugs: String,

    on_market: Boolean,
    off_market: Boolean,

    out_of_network_coverage: String,
    outpatient_facility: String,
    outpatient_mental_health: String,
    outpatient_physician: String,
    outpatient_substance: String,

    plan_market: String,
    preferred_brand_drugs: String,
    prenatal_postnatal_care: String,
    preventative_care: String,
    primary_care_physician: String,
    rehabilitation_services: String,
    skilled_nursing: String,
    specialist: String,
    specialty_drugs: String,
    urgent_care: String,

    actuarial_value: Number,
    chiropractic_services: String,
    coinsurance: String,
    embedded_deductible: String,
    gated: Boolean,

    imaging_center: String,
    imaging_physician: String,
    lab_test: String,
    mail_order_rx: String,
    nonpreferred_generic_drug_share: String,
    nonpreferred_specialty_drug_share: String,
    outpatient_ambulatory_care_center: String,
    plan_calendar: String,
    prenatal_care: String,
    postnatal_care: String,
    skilled_nursing_facility_365: String,
    essential_health_benefits_percentage: Number,
    covered_ages: String,
    formulary_name: String,
    issuer_plan_code: String,
    key_benefits_complete: String,
    sbc_name: String,
    updated_at: Date,

    privileged_data: String,
    _release_date: Date,
    actively_marketed: Boolean,
    network_size: Number,
    premium: Number,
    premium_subsidized: Number,
    package_codes: String,
    network_name: String,
    plan_coinsurance: String,

    inpatient_birth_physician: String,
    infertility_treatment_rider: String,
    abortion_rider: String,
    telemedicine: String,
    plan_ancestors: String,
    carrier_disclaimers: String,
    estimated_actuarial_value: Number,
    summary_of_benefits_url: String,
    network_provider_directory_url: String,

    cms_quality_ratings_overall: Number,
    cms_quality_ratings_medical_care: Number,
    cms_quality_ratings_member_experience: Number,
    cms_quality_ratings_plan_administration: Number,

    carrier_brand_id: String,
    standardized_plan: Boolean,
    _carrier_testing: Boolean,
    _embargo: Boolean
  },
  { timestamps: true }
);

// Fast metadata filters for the comparison UI
planSchema.index({ carrier_name: 1 });
planSchema.index({ level: 1 });
planSchema.index({ on_market: 1 });
planSchema.index({ off_market: 1 });

// filter by multiple at once:
planSchema.index({ carrier_name: 1, level: 1, on_market: 1 });


module.exports = mongoose.model('Plan', planSchema);
