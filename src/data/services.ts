import {
  Droplet, Wind, Filter, Zap, ShieldCheck, Cpu, Gauge, Wrench, Radar, Radio,
  Cog, Settings, Timer, Fuel, Snowflake, Battery, Circle, Lightbulb,
  CircuitBoard, Disc, Ruler, RotateCw, Move, Thermometer, AlertTriangle,
  HardDrive, Wifi, Sparkles, Shield, Key, Plug, type LucideIcon,
} from "lucide-react";
const maintenanceImg = "/assets/maintenance.jpg"; 
const diagnosticImg = "/assets/diagnostic.jpg";
const engineImg = "/assets/engine.jpg"; 
const electricalImg = "/assets/electrical.jpg"; 
const tiresImg = "/assets/tires.jpg";
// Maintenance category images
const oilChangeImg = "/assets/maintenance/m1.jpg"; 
const fluidFlushImg = "/assets/maintenance/m2.jpg"; 
const wiperBladeImg = "/assets/maintenance/m3.jpg"; 
const filterImg = "/assets/maintenance/m4.jpg"; 
const sparkPlugImg = "/assets/maintenance/m5.jpg"; 
const batteryCheckImg = "/assets/maintenance/m6.jpg"; 
const inspectionImg = "/assets/maintenance/m7.jpg"; 
const beltHoseImg = "/assets/maintenance/m8.jpg"; 
// Diagnostics category images
const diagScanImg = "/assets/diagnostic/c1.jpg"; 
const diagPerfImg = "/assets/diagnostic/c2.jpg"; 
const diagEmissionsImg = "/assets/diagnostic/c3.jpg"; 
const diagSensorImg = "/assets/diagnostic/c4.jpg"; 
const diagNoiseImg = "/assets/diagnostic/c5.jpg"; 
const diagCheckEngineImg = "/assets/diagnostic/c6.jpg"; 
// Engine category images
const engOverhaulImg = "/assets/engine/e1.png";
const engTransImg = "/assets/engine/e2.jpg"; 
const engTimingImg = "/assets/engine/e3.jpeg"; 
const engFuelImg = "/assets/engine/e4.jpg"; 
const engCoolingImg = "/assets/engine/e5.jpg";
// Electrical & AC category images
const elecBatteryImg = "/assets/ac/a1.jpg"; 
const elecAlternatorImg = "/assets/ac/a2.jpg"; 
const elecAcImg = "/assets/ac/a3.webp"; 
const elecLightingImg = "/assets/ac/a4.jpg"; 
const elecWiringImg = "/assets/ac/a5.jpg"; 
const elecStarterImg = "/assets/ac/a6.jpg"; 
// Tires & Brakes category images
const tireBrakePadImg = "/assets/tire/t1.jpg"; 
const tireRotorImg = "/assets/tire/t2.webp"; 
const tireAlignmentImg = "/assets/tire/t3.webp"; 
const tireRotationImg = "/assets/tire/t4.jpg"; 
const tireSuspensionImg = "/assets/tire/t5.webp"; 
export type ServiceItem = {
  icon: LucideIcon;
  title: string;
  desc: string;
  image?: string;
};

export type ServiceGroup = {
  name: string;
  code: string;
  photo: string;
  items: ServiceItem[];
};

export const groups: ServiceGroup[] = [
  {
    name: "Maintenance",
    code: "MNT",
    photo: maintenanceImg,
    items: [
      { icon: Droplet, title: "Full Synthetic Oil Change", desc: "Premium synthetic oil and filter replacement for maximum engine longevity.", image: oilChangeImg },
      { icon: Wind, title: "Fluid Flush & Refill", desc: "Complete replacement of essential fluids including coolant, brake, and transmission.", image: fluidFlushImg },
      { icon: Filter, title: "Filter Replacement", desc: "Replacement of air, cabin, and fuel filters to ensure optimal airflow and purity.", image: filterImg },
      { icon: Zap, title: "Spark Plug Service", desc: "Inspection and replacement of spark plugs to maintain fuel efficiency and power.", image: sparkPlugImg },
      { icon: ShieldCheck, title: "Multi-Point Inspection", desc: "Comprehensive 50-point safety and performance check of your entire vehicle.", image: inspectionImg },
      { icon: Sparkles, title: "Belt & Hose Inspection", desc: "Thorough check of drive belts and hoses to catch wear before it causes breakdowns.", image: beltHoseImg },
      { icon: Gauge, title: "Battery Health Check", desc: "Load testing and terminal cleaning to keep your battery reliable in any season.", image: batteryCheckImg },
      { icon: Wind, title: "Wiper Blade Replacement", desc: "Fresh wiper blades installed for clear visibility in rain and harsh weather.", image: wiperBladeImg },
    ],
  },
  {
    name: "Diagnostics",
    code: "DGN",
    photo: diagnosticImg,
    items: [
      { icon: Cpu, title: "Computerized Scanning", desc: "Advanced ECU scanning to decode check engine lights and hidden fault codes.", image: diagScanImg },
      { icon: Gauge, title: "Performance Testing", desc: "Real-time data logging to analyze engine output and efficiency under load.", image: diagPerfImg },
      { icon: Wrench, title: "Emissions Testing", desc: "Official inspection to ensure your vehicle meets environmental safety standards.", image: diagEmissionsImg },
      { icon: Radar, title: "Sensor Calibration", desc: "Precision adjustment of oxygen, mass airflow, and proximity sensors.", image: diagSensorImg },
      { icon: Radio, title: "Noise & Vibration Analysis", desc: "Specialized acoustic testing to locate mysterious rattles and mechanical hums.", image: diagNoiseImg },
      { icon: AlertTriangle, title: "Check Engine Light Diagnosis", desc: "In-depth root-cause analysis to resolve dashboard warning lights for good.", image: diagCheckEngineImg },
    ],
  },
  {
    name: "Engine & Transmission",
    code: "ENG",
    photo: engineImg,
    items: [
      { icon: Cog, title: "Engine Overhaul", desc: "Complete engine rebuilds including piston, ring, and bearing replacements.", image: engOverhaulImg },
      { icon: Settings, title: "Transmission Repair", desc: "Specialized service for both automatic and manual transmission systems.", image: engTransImg },
      { icon: Timer, title: "Timing Belt Service", desc: "Critical inspection of timing belts and water pumps to prevent engine failure.", image: engTimingImg },
      { icon: Fuel, title: "Fuel System Cleaning", desc: "Deep cleaning of fuel injectors and throttle bodies for better throttle response.", image: engFuelImg },
      { icon: Snowflake, title: "Cooling System Repair", desc: "Radiator, thermostat, and hose replacements to prevent engine overheating.", image: engCoolingImg },
    ],
  },
  {
    name: "Electrical & AC",
    code: "ELC",
    photo: electricalImg,
    items: [
      { icon: Battery, title: "Battery Replacement", desc: "Installation of high-capacity AGM and lead-acid batteries with testing.", image: elecBatteryImg },
      { icon: CircuitBoard, title: "Alternator Service", desc: "Repair and replacement of charging systems to ensure electrical stability.", image: elecAlternatorImg },
      { icon: Snowflake, title: "AC Recharge", desc: "Evacuation and recharging of air conditioning to keep your cabin ice-cold.", image: elecAcImg },
      { icon: Lightbulb, title: "Lighting Systems", desc: "LED upgrades and traditional bulb replacements for all exterior lights.", image: elecLightingImg },
      { icon: Zap, title: "Wiring Repair", desc: "Expert tracing and repair of complex electrical shorts and wiring harnesses.", image: elecWiringImg },
      { icon: Key, title: "Starter Motor Repair", desc: "Diagnosis and replacement of faulty starters to get your engine firing again.", image: elecStarterImg },
    ],
  },
  {
    name: "Tires & Brakes",
    code: "TBR",
    photo: tiresImg,
    items: [
      { icon: Disc, title: "Brake Pad Change", desc: "Premium ceramic or semi-metallic pad installation for quiet, safe stops.", image: tireBrakePadImg },
      { icon: Circle, title: "Rotor Resurfacing", desc: "Precision machining of brake rotors to eliminate vibration and squealing.", image: tireRotorImg },
      { icon: Ruler, title: "Tire Alignment", desc: "Laser-guided wheel alignment to prevent uneven tire wear and pulling.", image: tireAlignmentImg },
      { icon: RotateCw, title: "Tire Rotation & Balance", desc: "Optimizing tire longevity and ride smoothness through precise balancing.", image: tireRotationImg },
      { icon: Move, title: "Suspension Repair", desc: "Replacement of shocks, struts, and bushings for a smooth, controlled ride.", image: tireSuspensionImg },
    ],
  },
];

export function getGroupByCode(code: string) {
  return groups.find((g) => g.code.toLowerCase() === code.toLowerCase());
}
