
// src/data/syllabus-data.ts

export type ExamName = "MHT CET" | "JEE MAIN" | "NEET";
export type SubjectName = "Physics" | "Chemistry" | "Mathematics" | "Biology";

export interface Topic {
  name: string;
  // Future: Add subtopics, importance, etc.
}

export interface Lesson {
  name: string;
  topics: string[]; // Array of topic names
}

export interface SubjectSyllabus {
  subjectName: SubjectName;
  lessons: Lesson[];
}

export interface ExamSyllabus {
  examName: ExamName;
  subjects: SubjectSyllabus[];
}

export const SYLLABUS_DATA: Record<ExamName, SubjectSyllabus[]> = {
  "MHT CET": [
    {
      subjectName: "Physics",
      lessons: [
        { name: "Circular Motion", topics: ["Uniform Circular Motion (UCM)", "Non-UCM", "Centripetal Force", "Banking of Roads", "Vertical Circular Motion"] },
        { name: "Gravitation", topics: ["Newton's Law of Gravitation", "Acceleration due to Gravity (g)", "Variation in g", "Gravitational Potential Energy", "Escape Velocity", "Kepler's Laws", "Satellites"] },
        { name: "Rotational Motion", topics: ["Moment of Inertia", "Radius of Gyration", "Torque", "Angular Momentum", "Conservation of Angular Momentum", "Rolling Motion"] },
        { name: "Oscillations", topics: ["Simple Harmonic Motion (SHM)", "Energy in SHM", "Damped Oscillations", "Forced Oscillations", "Resonance", "Composition of two SHMs"] },
        { name: "Elasticity", topics: ["Stress and Strain", "Hooke's Law", "Young's Modulus", "Bulk Modulus", "Shear Modulus", "Poisson's Ratio", "Elastic Potential Energy"] },
        { name: "Surface Tension", topics: ["Surface Energy", "Angle of Contact", "Capillary Action", "Excess Pressure in Drops and Bubbles"] },
        { name: "Wave Motion", topics: ["Progressive Waves", "Transverse and Longitudinal Waves", "Speed of Waves", "Principle of Superposition", "Reflection of Waves"] },
        { name: "Stationary Waves", topics: ["Formation of Stationary Waves", "Nodes and Antinodes", "Harmonics and Overtones", "Vibrations in Stretched Strings", "Vibrations in Air Columns"] },
        { name: "Kinetic Theory of Gases and Radiation", topics: ["Ideal Gas Equation", "Pressure of Gas", "RMS Speed", "Degrees of Freedom", "Law of Equipartition of Energy", "Mean Free Path", "Blackbody Radiation", "Wien's Law", "Stefan-Boltzmann Law"] },
        { name: "Thermodynamics", topics: ["Zeroth Law", "First Law of Thermodynamics", "Heat, Work, Internal Energy", "Thermodynamic Processes (Isobaric, Isochoric, Isothermal, Adiabatic)", "Second Law of Thermodynamics", "Heat Engines", "Refrigerators", "Carnot Cycle"] },
        { name: "Wave Optics", topics: ["Huygens' Principle", "Reflection and Refraction of Waves", "Interference", "Young's Double Slit Experiment (YDSE)", "Diffraction (Single Slit)", "Polarization", "Brewster's Law"] },
        { name: "Electrostatics", topics: ["Coulomb's Law", "Electric Field", "Electric Flux", "Gauss's Law", "Electric Potential", "Potential Energy", "Conductors and Insulators", "Capacitors and Capacitance", "Dielectrics"] },
        { name: "Current Electricity", topics: ["Ohm's Law", "Resistance and Resistivity", "Kirchhoff's Laws", "Cells (EMF, Internal Resistance)", "Combination of Resistors and Cells", "Potentiometer", "Wheatstone Bridge", "Meter Bridge"] },
        { name: "Magnetic Effects of Electric Current", topics: ["Biot-Savart Law", "Ampere's Circuital Law", "Magnetic Field due to Straight Conductor and Circular Loop", "Force on a Moving Charge in Magnetic Field", "Force on a Current-Carrying Conductor", "Torque on a Current Loop", "Moving Coil Galvanometer (MCG)"] },
        { name: "Magnetism", topics: ["Magnetic Dipole Moment", "Earth's Magnetism", "Magnetic Materials (Dia, Para, Ferro)", "Hysteresis"] },
        { name: "Electromagnetic Induction (EMI)", topics: ["Faraday's Laws", "Lenz's Law", "Motional EMF", "Self and Mutual Inductance", "AC Generators"] },
        { name: "AC Circuits", topics: ["Alternating Current and Voltage", "Phasors", "LCR Circuits (Series and Parallel)", "Resonance", "Power in AC Circuits", "Transformers", "LC Oscillations"] },
        { name: "Dual Nature of Radiation and Matter", topics: ["Photoelectric Effect", "Einstein's Photoelectric Equation", "Wave Nature of Matter", "De Broglie Hypothesis", "Davisson-Germer Experiment"] },
        { name: "Structure of Atoms and Nuclei", topics: ["Rutherford's Model", "Bohr's Model of Atom", "Hydrogen Spectrum", "Composition of Nucleus", "Nuclear Binding Energy", "Radioactivity", "Nuclear Fission and Fusion"] },
        { name: "Semiconductor Devices", topics: ["Energy Bands in Solids", "Intrinsic and Extrinsic Semiconductors", "PN Junction Diode (Forward and Reverse Bias)", "Rectifiers", "Zener Diode", "Transistors (NPN, PNP)", "Logic Gates"] },
        { name: "Communication Systems", topics: ["Elements of Communication System", "Modulation (AM, FM)", "Bandwidth", "Propagation of EM Waves"] },
      ],
    },
    {
      subjectName: "Chemistry",
      lessons: [
        { name: "Solid State", topics: ["Classification of Solids", "Crystal Lattices", "Unit Cells", "Packing Efficiency", "Defects in Solids", "Electrical and Magnetic Properties"] },
        { name: "Solutions", topics: ["Types of Solutions", "Concentration Terms", "Raoult's Law", "Colligative Properties (RLVP, Elevation in BP, Depression in FP, Osmotic Pressure)", "Van't Hoff Factor", "Ideal and Non-ideal Solutions"] },
        { name: "Ionic Equilibria", topics: ["Acids, Bases, Salts", "Arrhenius, Bronsted-Lowry, Lewis Concepts", "Ionization of Acids and Bases", "pH Scale", "Buffer Solutions", "Solubility Product", "Common Ion Effect"] },
        { name: "Chemical Thermodynamics", topics: ["Concepts of System, Surroundings", "Work, Heat, Energy", "First Law of Thermodynamics", "Enthalpy", "Hess's Law", "Entropy", "Gibbs Free Energy", "Second and Third Law of Thermodynamics"] },
        { name: "Electrochemistry", topics: ["Electrolytic and Metallic Conduction", "Conductance", "Kohlrausch's Law", "Electrochemical Cells (Galvanic, Electrolytic)", "Nernst Equation", "EMF Series", "Batteries", "Corrosion"] },
        { name: "Chemical Kinetics", topics: ["Rate of Reaction", "Factors Affecting Rate", "Rate Law", "Order and Molecularity", "Integrated Rate Equations (Zero and First Order)", "Activation Energy", "Arrhenius Equation", "Collision Theory"] },
        { name: "Elements of Groups 1 and 2 (Alkali and Alkaline Earth Metals)", topics: ["General Introduction", "Electronic Configuration", "Trends in Properties", "Important Compounds (NaCl, NaOH, Na2CO3, CaO, CaCO3, Plaster of Paris)", "Biological Importance"] },
        { name: "Elements of Groups 16, 17 and 18 (p-Block Elements)", topics: ["General Introduction", "Electronic Configuration", "Trends in Properties (Oxidation States, Physical and Chemical Properties)", "Oxygen, Ozone, Sulphur (Allotropes, Compounds)", "Halogens (Compounds, Interhalogen Compounds)", "Noble Gases (Compounds)"] },
        { name: "Transition and Inner Transition Elements (d and f Block Elements)", topics: ["General Introduction", "Electronic Configuration", "General Trends in Properties (Metallic Character, Ionization Enthalpy, Oxidation States, Color, Catalytic Property, Magnetic Properties)", "Lanthanoids and Actinoids"] },
        { name: "Coordination Compounds", topics: ["Werner's Theory", "Ligands", "Coordination Number", "Nomenclature", "Isomerism", "Valence Bond Theory", "Crystal Field Theory", "Importance of Coordination Compounds"] },
        { name: "Halogen Derivatives", topics: ["Classification", "Nomenclature", "Nature of C-X Bond", "Methods of Preparation", "Physical and Chemical Properties", "SN1 and SN2 Reactions", "Polyhalogen Compounds"] },
        { name: "Alcohols, Phenols and Ethers", topics: ["Classification", "Nomenclature", "Methods of Preparation", "Physical and Chemical Properties", "Acidity of Alcohols and Phenols", "Mechanism of Dehydration"] },
        { name: "Aldehydes, Ketones and Carboxylic Acids", topics: ["Nomenclature", "Structure of Carbonyl Group", "Methods of Preparation", "Physical and Chemical Properties", "Nucleophilic Addition Reactions", "Acidity of Carboxylic Acids"] },
        { name: "Amines (Organic Compounds Containing Nitrogen)", topics: ["Nomenclature", "Classification", "Structure", "Methods of Preparation", "Physical and Chemical Properties", "Basicity of Amines", "Diazonium Salts"] },
        { name: "Biomolecules", topics: ["Carbohydrates (Classification, Glucose, Fructose, Sucrose, Polysaccharides)", "Proteins (Amino Acids, Peptide Bond, Structure)", "Enzymes", "Vitamins", "Nucleic Acids (DNA, RNA)"] },
        { name: "Introduction to Polymer Chemistry", topics: ["Classification", "Types of Polymerization", "Some Important Polymers (Polythene, Nylon, Polyester, Bakelite, Rubber)"] },
        { name: "Green Chemistry and Nanochemistry", topics: ["Principles of Green Chemistry", "Role of Green Chemistry", "Introduction to Nanochemistry", "Nanomaterials", "Applications"] },
      ],
    },
    {
      subjectName: "Mathematics",
      lessons: [
        { name: "Mathematical Logic", topics: ["Statements", "Logical Connectives", "Truth Tables", "Tautology, Contradiction, Contingency", "Quantifiers and Quantified Statements", "Duality", "Negation of Compound Statements", "Algebra of Statements"] },
        { name: "Matrices", topics: ["Types of Matrices", "Algebra of Matrices", "Elementary Transformations", "Inverse of a Matrix (Elementary Transformation and Adjoint Method)", "Solution of System of Linear Equations"] },
        { name: "Trigonometric Functions", topics: ["Trigonometric Equations and their Solutions", "Inverse Trigonometric Functions", "Properties of Inverse Trigonometric Functions", "Solution of Triangles (Sine Rule, Cosine Rule, Projection Rule)"] },
        { name: "Pair of Straight Lines", topics: ["Combined Equation of a Pair of Lines", "Angle between Lines", "Condition for Perpendicular and Parallel Lines", "Homogeneous Equation of Second Degree"] },
        { name: "Vectors", topics: ["Scalars and Vectors", "Types of Vectors", "Algebra of Vectors", "Scalar (Dot) Product", "Vector (Cross) Product", "Scalar Triple Product", "Vector Triple Product", "Applications to Geometry"] },
        { name: "Three Dimensional Geometry", topics: ["Direction Cosines and Direction Ratios", "Angle between Two Lines", "Equation of a Line in Space", "Shortest Distance between Two Lines", "Equation of a Plane", "Angle between Two Planes", "Distance of a Point from a Plane", "Equation of a Sphere"] },
        { name: "Line", topics: ["Equation of Line in Different Forms", "Angle between Lines", "Distance of a Point from a Line", "Concurrency of Lines"] },
        { name: "Plane", topics: ["Equation of Plane in Different Forms", "Angle between Two Planes", "Distance of a Point from a Plane", "Equation of a Plane Passing through Intersection of Two Planes"] },
        { name: "Linear Programming", topics: ["Introduction", "Mathematical Formulation of LPP", "Graphical Method of Solving LPP", "Types of LPP Problems (Manufacturing, Diet, Transportation)"] },
        { name: "Continuity", topics: ["Continuity of a Function at a Point", "Continuity over an Interval", "Types of Discontinuities", "Properties of Continuous Functions"] },
        { name: "Differentiation", topics: ["Derivative of Composite, Inverse, Logarithmic, Implicit, Parametric Functions", "Second Order Derivative"] },
        { name: "Applications of Derivatives", topics: ["Rate of Change", "Approximations", "Rolle's Theorem", "Lagrange's Mean Value Theorem", "Increasing and Decreasing Functions", "Maxima and Minima"] },
        { name: "Integration", topics: ["Indefinite Integration (Methods of Substitution, Integration by Parts, Partial Fractions)", "Definite Integration (Properties, Fundamental Theorem of Calculus)", "Applications of Definite Integrals (Area under Curve)"] },
        { name: "Differential Equations", topics: ["Order and Degree", "Formation of Differential Equations", "Solution of Differential Equations (Variable Separable, Homogeneous, Linear)", "Applications"] },
        { name: "Probability Distribution", topics: ["Random Variable", "Probability Mass Function (PMF)", "Probability Density Function (PDF)", "Expected Value and Variance", "Binomial Distribution"] },
        { name: "Binomial Distribution", topics: ["Bernoulli Trials", "Binomial Distribution Formula", "Mean and Variance of Binomial Distribution"] },
      ],
    },
     {
      subjectName: "Biology",
      lessons: [
        { name: "Reproduction in Lower and Higher Plants", topics: ["Asexual Reproduction", "Sexual Reproduction", "Pollination", "Fertilization", "Development of Embryo", "Apomixis", "Polyembryony"] },
        { name: "Reproduction in Lower and Higher Animals", topics: ["Asexual Reproduction in Animals", "Human Reproductive System (Male and Female)", "Gametogenesis", "Menstrual Cycle", "Fertilization and Implantation", "Pregnancy and Embryonic Development", "Parturition and Lactation"] },
        { name: "Inheritance and Variation", topics: ["Mendel's Laws", "Incomplete Dominance", "Codominance", "Multiple Alleles", "Pleiotropy", "Polygenic Inheritance", "Chromosomal Theory of Inheritance", "Sex Determination", "Linkage and Crossing Over", "Mutation", "Genetic Disorders"] },
        { name: "Molecular Basis of Inheritance", topics: ["DNA Structure", "Search for Genetic Material", "RNA World", "DNA Replication", "Transcription", "Genetic Code", "Translation", "Regulation of Gene Expression (Lac Operon)", "Human Genome Project", "DNA Fingerprinting"] },
        { name: "Origin and Evolution of Life", topics: ["Origin of Life Theories", "Evidences of Evolution", "Darwinism", "Modern Synthetic Theory of Evolution", "Hardy-Weinberg Principle", "Adaptive Radiation", "Human Evolution"] },
        { name: "Plant Water Relation", topics: ["Properties of Water", "Water Potential", "Osmosis", "Plasmolysis", "Imbibition", "Absorption of Water by Plants", "Ascent of Sap", "Transpiration"] },
        { name: "Plant Growth and Mineral Nutrition", topics: ["Phases of Growth", "Growth Rate", "Conditions for Growth", "Plant Growth Regulators (Auxins, Gibberellins, Cytokinins, Ethylene, ABA)", "Photoperiodism", "Vernalization", "Mineral Nutrition (Macro and Micro Nutrients, Deficiency Symptoms)"] },
        { name: "Respiration and Circulation", topics: ["Respiratory Organs in Animals", "Human Respiratory System", "Mechanism of Breathing", "Exchange of Gases", "Transport of Gases", "Regulation of Respiration", "Human Circulatory System (Heart, Blood Vessels, Blood)", "Cardiac Cycle", "ECG", "Double Circulation", "Regulation of Cardiac Activity", "Disorders of Circulatory System"] },
        { name: "Control and Coordination", topics: ["Nervous System in Humans (Brain, Spinal Cord, PNS)", "Neuron Structure and Function", "Nerve Impulse Generation and Conduction", "Synapse", "Reflex Action", "Sensory Receptors (Eye, Ear)", "Endocrine System (Hormones, Glands)"] },
        { name: "Human Health and Diseases", topics: ["Common Diseases in Humans (Bacterial, Viral, Fungal, Protozoan, Helminthic)", "Immunity (Innate, Acquired)", "AIDS", "Cancer", "Drugs and Alcohol Abuse"] },
        { name: "Enhancement of Food Production", topics: ["Plant Breeding", "Animal Husbandry", "Apiculture", "Fisheries", "Single Cell Protein", "Tissue Culture"] },
        { name: "Biotechnology", topics: ["Principles and Processes", "Recombinant DNA Technology", "Tools of Recombinant DNA Technology", "Applications in Agriculture and Medicine", "Genetically Modified Organisms (GMO)", "Ethical Issues"] },
        { name: "Organisms and Populations", topics: ["Organism and its Environment", "Population Attributes", "Population Growth", "Population Interactions (Mutualism, Competition, Predation, Parasitism)"] },
        { name: "Ecosystems and Energy Flow", topics: ["Ecosystem Structure and Function", "Productivity", "Decomposition", "Energy Flow", "Ecological Pyramids", "Nutrient Cycling (Carbon, Phosphorus)"] },
        { name: "Biodiversity, Conservation and Environmental Issues", topics: ["Concept of Biodiversity", "Patterns of Biodiversity", "Loss of Biodiversity", "Biodiversity Conservation (In-situ, Ex-situ)", "Environmental Issues (Air Pollution, Water Pollution, Solid Wastes, Climate Change, Ozone Layer Depletion, Deforestation)"] },
      ],
    },
  ],
  "JEE MAIN": [
    {
      subjectName: "Physics",
      lessons: [
        { name: "Units and Measurement", topics: ["Units", "Dimensions", "Errors in Measurement", "Significant Figures", "Dimensional Analysis"] },
        { name: "Kinematics", topics: ["Motion in a Straight Line", "Projectile Motion", "Uniform Circular Motion", "Vectors", "Relative Velocity"] },
        // Add more JEE Main Physics lessons and topics here
      ],
    },
    {
      subjectName: "Chemistry",
      lessons: [
        { name: "Some Basic Concepts in Chemistry", topics: ["Matter", "Dalton's atomic theory", "Mole concept", "Stoichiometry"] },
        { name: "States of Matter", topics: ["Gas laws", "Ideal gas equation", "Kinetic theory", "Real gases", "Liquids", "Solids"] },
        // Add more JEE Main Chemistry lessons and topics here
      ],
    },
    {
      subjectName: "Mathematics",
      lessons: [
        { name: "Sets, Relations and Functions", topics: ["Sets", "Relations", "Functions", "Types of functions"] },
        { name: "Complex Numbers and Quadratic Equations", topics: ["Complex numbers", "Argand diagram", "Quadratic equations", "Roots of quadratic equations"] },
        // Add more JEE Main Mathematics lessons and topics here
      ],
    },
  ],
  "NEET": [
    {
      subjectName: "Physics",
      lessons: [
        { name: "Physical World and Measurement", topics: ["Units of measurement", "Errors in measurement", "Dimensions of physical quantities"] },
        { name: "Kinematics", topics: ["Motion in a straight line", "Motion in a plane", "Projectile motion", "Uniform circular motion"] },
        // Add more NEET Physics lessons and topics here
      ],
    },
    {
      subjectName: "Chemistry",
      lessons: [
        { name: "Some Basic Concepts of Chemistry", topics: ["Laws of chemical combination", "Dalton's atomic theory", "Mole concept", "Stoichiometry"] },
        { name: "Structure of Atom", topics: ["Atomic number", "Isotopes and isobars", "Quantum numbers", "Shapes of orbitals"] },
        // Add more NEET Chemistry lessons and topics here
      ],
    },
    {
      subjectName: "Biology",
      lessons: [
        { name: "The Living World", topics: ["Diversity", "Taxonomy", "Systematics", "Binomial nomenclature"] },
        { name: "Biological Classification", topics: ["Five kingdom classification", "Monera", "Protista", "Fungi", "Viruses"] },
        // Add more NEET Biology lessons and topics here
      ],
    },
  ],
};

// Helper function to get topics for a specific lesson
export const getTopicsForLesson = (exam: ExamName, subject: SubjectName, lessonName: string): string[] => {
  const examSyllabus = SYLLABUS_DATA[exam];
  if (!examSyllabus) return [];
  const subjectSyllabus = examSyllabus.find(s => s.subjectName === subject);
  if (!subjectSyllabus) return [];
  const lesson = subjectSyllabus.lessons.find(l => l.name === lessonName);
  return lesson ? lesson.topics : [];
};

