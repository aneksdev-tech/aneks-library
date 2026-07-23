export const academicData = {
  "College of Agricultural Economics, Rural Sociology & Extension (CAERSE)": [
    "Agribusiness and Management",
    "Agricultural Economics",
    "Agricultural Extension and Rural Sociology",
  ],

  "College Of Animal Science & Animal Production (CASAP)": [
    "Animal Breeding And Physiology",
    "Animal Nutrition And Forage Science",
    "Animal Production and Livestock Management",
  ],

  "College Of Applied Food Science & Tourism (CAFST)": [
    "Human Nutrition and Dietetics",
    "Home Science/Hospitality Management & Tourism",
    "Food Science and Technology",
  ],

  "College Of Crop & Soil Sciences (CCSS)": [
    "Agronomy",
    "Plant Health Management",
    "Soil Science and Meteorology",
    "Water Resources Management and Agrometeorology",
  ],

  "College Of Education (COED)": [
    "Adult and Continuing Education",
    "Agricultural/Home Science Education",
    "Business Education",
    "Economics Education",
    "Education Management",
    "Industrial Technology Education",
    "Library and Information Science",
    "Guidance and Counselling",
    "Integrated Science Education",
  ],

  "College Of Engineering & Engineering Technology (CEET)": [
    "Agricultural and Bioresources Engineering",
    "Civil Engineering",
    "Chemical Engineering",
    "Computer Engineering",
    "Electrical and Electronics Engineering",
    "Mechanical Engineering",
  ],

  "College Of Management Science (COLMAS)": [
    "Marketing",
    "Accounting",
    "Banking and Finance",
    "Economics",
    "Industrial Relations and Personnel Management",
    "Entrepreneurial Studies",
    "Business Administration",
  ],

  "College Of Natural Resources & Environmental Management (CNREM)": [
    "Environment Management and Toxicology",
    "Fisheries and Aquatic Resources Management",
    "Forestry and Environmental Management",
  ],

  "College Of Natural Science (COLNAS)": [
    "Biochemistry",
    "Microbiology",
    "Plant Science and Biotechnology",
    "Zoology and Environmental Biology",
  ],

  "College Of Physical & Applied Science (COLPAS)": [
    "Chemistry",
    "Computer Science",
    "Geology",
    "Mathematics",
    "Physics",
    "Statistics",
  ],

  "College Of Veterinary Medicine (CVM)": [
    "Theriogenology",
    "Veterinary Anatomy",
    "Veterinary Medicine",
    "Veterinary Microbiology",
    "Veterinary Public Health and Preventive Medicine",
    "Veterinary Surgery and Radiology",
  ],

  "School Of General Studies (SGS)": [
    "English",
    "French",
    "German",
    "History",
    "Social Science",
    "Physical and Health",
    "Philosophy",
    "Peace and Conflict",
  ],
} as const;

export const colleges = Object.keys(academicData);

export const levels = [
  "100 Level",
  "200 Level",
  "300 Level",
  "400 Level",
  "500 Level",
] as const;

export const semesters = [
  "First Semester",
  "Second Semester",
] as const;

export const years = Array.from(
  { length: 15 },
  (_, i) => new Date().getFullYear() - 5 + i
);