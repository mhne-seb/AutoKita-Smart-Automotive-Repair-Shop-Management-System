# Diagnostic Strategies — AutoKita Knowledge Base

## The Right Diagnostic Mindset
Do not replace parts based on a code alone. A code tells you WHICH circuit or system has a problem — not WHICH part failed. Always test before replacing.

Example: P0300 (misfire) does not necessarily mean bad spark plugs. It could be:
- Faulty ignition coil (most common)
- Clogged fuel injector
- Vacuum leak
- Low engine compression
- Failing crankshaft position sensor

---

## Intermittent Fault Strategy
Intermittent faults are the hardest to diagnose because they are not always present.

Steps:
1. Record freeze frame data from the OBD scanner — note engine temp, RPM, speed, and load when the fault occurred.
2. Look for patterns: Does it happen when hot? Cold? Under load? At idle?
3. Wiggle test: With the engine running, gently wiggle wiring harnesses near suspect sensors/components. If the fault triggers, you found a wiring issue.
4. Data logging: Use a scanner that can log live data while driving. Graph O2 sensor voltage, MAF reading, etc.

---

## Vacuum Leak Diagnosis
Vacuum leaks cause: lean codes (P0171/P0174), rough idle, hissing noise, high idle RPM.

Methods:
1. Visual inspection: Look for cracked, disconnected, or collapsed vacuum hoses.
2. Brake cleaner method: With engine running, spray small amounts of brake cleaner near intake manifold gasket edges, throttle body, and vacuum hoses. If idle changes, you found the leak. CAUTION: Fire risk — keep away from ignition sources and hot components.
3. Smoke machine: Professional method — force smoke into the intake. Smoke escapes from any leak point.

Common leak locations:
- Intake manifold gasket (especially on older engines)
- Throttle body gasket
- PCV hose or valve
- Brake booster vacuum line
- EGR valve gasket

---

## Fuel System Diagnosis

### Fuel Pressure Testing
Connect a fuel pressure gauge to the Schrader valve on the fuel rail.
- Key on, engine off: Should build to spec (typically 40–65 PSI for port injection, 1,500–2,000 PSI for direct injection — do not test GDI with standard gauge).
- Engine running: Should hold steady. Large drops under acceleration = weak fuel pump.
- After shutoff: Should hold pressure for several minutes. Rapid drop = leaking injector or failed check valve in fuel pump.

### Fuel Injector Testing
- Noid light: Plug into injector connector with engine running. Should flash. No flash = wiring/ECU issue.
- Resistance test: Typically 12–16 ohms for port injectors.
- Ultrasonic cleaning: Preferred over replacement for partially clogged injectors.

---

## Ignition System Diagnosis

### Spark Plug Inspection (tells you a lot)
- Light tan/gray: Normal combustion — healthy engine.
- Black and sooty: Too rich (too much fuel) — check injectors, O2 sensor.
- Wet/oily: Oil burning — worn piston rings or valve seals.
- White/blistered: Overheating — check coolant level, thermostat, timing.
- Worn electrode (rounded): Time for replacement.

### Ignition Coil Testing
- Resistance test: Primary 0.5–2 ohms, secondary 6,000–15,000 ohms (varies by coil type).
- Swap test: On coil-on-plug (COP) systems, swap the suspect coil to another cylinder. If the misfire code follows the coil, the coil is bad.

---

## Electrical/Wiring Diagnosis

### Voltage Drop Testing
A voltage drop test checks for resistance in a circuit while current is flowing (more accurate than simple continuity testing).

Method:
1. Set multimeter to DC millivolts.
2. Place probes across the suspected circuit segment.
3. Activate the circuit.
4. Reading should be less than 0.1V (100mV) for power wires, less than 50mV for ground wires. Higher = excessive resistance.

### Ground Path Integrity
Poor grounds cause many mysterious electrical faults (sensor errors, erratic gauges, no-start).
Always check:
- Battery ground to chassis
- Engine block ground strap
- Body ground strap near the battery

---

## Overheating Diagnosis
Symptoms: Temperature gauge rising, coolant smell, steam from hood, heater blowing cold.

Step-by-step:
1. Check coolant level in reservoir (do NOT open radiator cap on hot engine — risk of severe scalding).
2. Check for coolant leaks under vehicle, around hose connections, water pump, radiator.
3. Check cooling fan operation: Should activate when A/C is on or engine reaches operating temperature.
4. Thermostat: If engine takes too long to warm up or overheats — thermostat failure. Replacement is inexpensive.
5. Head gasket (worst case): Signs — white smoke from exhaust, milky oil on dipstick, bubbles in coolant reservoir, coolant loss without visible leak.

Philippines Note: Overheating in traffic is common. Check:
- Coolant level monthly
- Radiator for clogged fins (bugs, road debris)
- Electric cooling fan operation (crucial in stop-and-go traffic where there is no airflow through the radiator)

---

## Battery and Charging System Diagnosis

### Alternator Testing
- Voltage at idle with engine running: 13.8–14.8V at battery terminals.
- Below 13.5V: Alternator undercharging. Check alternator belt tension first, then output.
- Above 15V: Alternator overcharging. Risk of battery damage. Check voltage regulator.

### Parasitic Draw Testing
Vehicle battery draining overnight = parasitic draw (something is staying on when the key is off).

Method:
1. Set multimeter to DC amps (10A range).
2. Disconnect negative battery terminal.
3. Connect multimeter in series (between disconnected cable and battery).
4. Normal draw after modules sleep: less than 50mA (0.05A). More = parasitic draw.
5. Pull fuses one by one until the draw drops — the circuit with the draw is the culprit.

---

## Air Conditioning System Diagnosis

### Not Cooling Enough
1. Check refrigerant pressure (manifold gauge required).
2. Check condenser fan operation (in front of radiator — must spin when A/C is on).
3. Check cabin air filter — a clogged filter severely reduces airflow from vents.
4. Check evaporator for ice buildup (usually from low refrigerant or faulty expansion valve).

### Compressor Not Engaging
1. Check A/C fuse and relay.
2. Check refrigerant pressure — compressor will not engage if pressure is too low (safety cutout).
3. Check compressor clutch voltage (should be 12V when A/C is on and refrigerant is adequate).
4. Test compressor clutch coil resistance: typically 3–4 ohms.

Philippines Note: A/C systems in the Philippines run continuously and at high load. Annual inspection is recommended. Cabin air filters should be replaced every 15,000 km in Metro Manila due to heavy pollution and dust.
