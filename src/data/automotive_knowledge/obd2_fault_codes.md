# OBD-II Fault Codes — AutoKita Knowledge Base

## What is OBD-II?
OBD-II (On-Board Diagnostics, second generation) is a standardized system present in all vehicles
manufactured after 1996. It monitors engine, transmission, and emissions systems and stores Diagnostic
Trouble Codes (DTCs) when a fault is detected.

Code format: [Letter][4 digits]
- P = Powertrain (engine, transmission)
- B = Body (airbags, climate, windows)
- C = Chassis (ABS, brakes, suspension)
- U = Network / communication faults

---

## P0300 — Random/Multiple Cylinder Misfire Detected
Causes: Worn spark plugs, bad ignition coil, clogged fuel injector, vacuum leak, low compression, faulty crankshaft position sensor.
Symptoms: Rough idle, hesitation on acceleration, poor fuel economy, engine shaking.
Repair: Start with spark plugs and ignition coils. Check fuel injectors. Perform compression test if plugs/coils are OK.

## P0301 — Cylinder 1 Misfire Detected
Causes: Faulty spark plug or coil on cylinder 1, bad injector, low compression in cylinder 1.
Repair: Swap the coil-on-plug from cylinder 1 to cylinder 2. If the misfire moves to P0302, the coil is bad.

## P0302 — Cylinder 2 Misfire Detected
Same diagnosis procedure as P0301 but for cylinder 2.

## P0303 — Cylinder 3 Misfire Detected
Same diagnosis procedure as P0301 but for cylinder 3.

## P0304 — Cylinder 4 Misfire Detected
Same diagnosis procedure as P0301 but for cylinder 4.

## P0100 — Mass Air Flow (MAF) Sensor Circuit Malfunction
Causes: Dirty or failed MAF sensor, air intake leak, wiring fault.
Symptoms: Rough idle, poor performance, black smoke, engine stall.
Repair: Clean MAF sensor with MAF-specific cleaner. If cleaning does not fix it, replace the sensor.

## P0101 — MAF Sensor Range/Performance Problem
Causes: Air filter blockage, air intake duct cracked, MAF sensor contaminated.
Repair: Replace air filter, inspect intake hose for cracks, clean or replace MAF.

## P0120 — Throttle Position Sensor (TPS) Circuit Malfunction
Causes: Dirty or failed TPS, wiring issue.
Symptoms: Hesitation, surging, poor fuel economy.
Repair: Clean throttle body and TPS. Replace TPS if fault persists.

## P0171 — System Too Lean (Bank 1)
Causes: Vacuum leak, weak fuel pump, clogged fuel injectors, dirty MAF sensor, faulty O2 sensor.
Symptoms: Rough idle, hesitation, poor fuel economy.
Repair: Check for vacuum leaks first (smoke test). Clean MAF. Check fuel pressure.

## P0172 — System Too Rich (Bank 1)
Causes: Faulty O2 sensor, leaking fuel injector, high fuel pressure, faulty coolant temp sensor.
Symptoms: Black smoke, smell of fuel, poor fuel economy.
Repair: Check O2 sensors, fuel injectors, and coolant temp sensor.

## P0420 — Catalyst System Efficiency Below Threshold (Bank 1)
Causes: Failed catalytic converter, failed downstream O2 sensor, exhaust leak before sensor, running rich.
Symptoms: Check engine light, possibly reduced power.
Repair: First fix any misfires or rich conditions. Replace the downstream O2 sensor first. If code returns, replace catalytic converter.
Philippines note: Low-quality fuel accelerates catalytic converter failure. Use at least RON 95 fuel.

## P0430 — Catalyst System Efficiency Below Threshold (Bank 2)
Same as P0420 but for Bank 2.

## P0325 — Knock Sensor 1 Circuit Malfunction
Causes: Failed knock sensor, wiring fault, loose sensor.
Symptoms: Reduced performance, retarded ignition timing, poor fuel economy.
Repair: Check sensor wiring harness. Replace knock sensor.
Philippines note: Using lower-octane fuel than required can trigger false knock and retarded timing.

## P0335 — Crankshaft Position Sensor A Circuit Malfunction
Causes: Failed CKP sensor, wiring fault, damaged reluctor wheel.
Symptoms: No-start, stalling, engine cranks but will not fire.
Repair: Check wiring first. Replace CKP sensor.

## P0340 — Camshaft Position Sensor A Circuit Malfunction
Causes: Failed CMP sensor, wiring fault, timing chain jumped.
Symptoms: Hard start, rough idle, stalling.
Repair: Check sensor and wiring. If timing is also off, inspect timing chain/belt.

## P0440 — Evaporative Emission Control System Malfunction
Causes: Loose or missing fuel cap, cracked EVAP hose, faulty purge valve.
Repair: Tighten or replace the fuel cap. If code returns, inspect hoses and test purge/vent valves.

## P0455 — EVAP System Large Leak Detected
Causes: Missing/loose fuel cap, large EVAP hose crack, stuck-open purge valve.
Repair: Check fuel cap first. If code persists, perform smoke test.

## P0700 — Transmission Control System Malfunction
Causes: TCM malfunction, failed solenoid, wiring issue. Often accompanied by other P07xx codes.
Repair: Scan for additional transmission codes. Address sub-codes first.

## P0730 — Incorrect Gear Ratio
Causes: Worn transmission clutch packs, solenoid failure, low transmission fluid.
Symptoms: Slipping gears, harsh shifts, delayed engagement.
Repair: Check transmission fluid level and condition. If fluid is burnt/dark, flush and fill.

## C0035 — Right Front Wheel Speed Sensor Circuit
Causes: Failed wheel speed sensor, damaged reluctor ring, wiring fault.
Symptoms: ABS warning light, traction control deactivated.
Repair: Inspect sensor and wiring at the wheel hub. Replace sensor if resistance is out of spec.

---

## General Diagnostic Workflow
1. Read and record all codes before clearing them.
2. Check for obvious things first: fuel cap, air filter, vacuum hoses, wiring.
3. Test components before replacing — do not just swap parts blindly.
4. After repair, clear codes and verify with a drive cycle.

## Philippines-Specific Notes
- Heat: Philippines heat accelerates rubber seal and hose degradation. Check vacuum hoses on every inspection.
- Flood damage: Water ingress into engine bay corrodes connectors and can cause multiple U-codes.
- Fuel quality: RON 91 is the minimum. Use RON 95 or RON 97 in turbo or high-compression engines.
- Traffic idling: Excessive idling causes carbon buildup, O2 sensor fouling, and overheating.
