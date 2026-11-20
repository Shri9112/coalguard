# CoalGuard: Engineering Limitations & Future Roadmap

---

## 1. Safety & Certification Boundaries

CoalGuard is an academic prototype created for teaching and demonstrating applied Soft Computing algorithms.

1. **Not a Certified Fire Alarm Controller:** It does not comply with industrial life-safety standards such as NFPA 120 (Standard for Fire Prevention and Control in Coal Mines), EN 54 (Fire Detection and Fire Alarm Systems), or IEC 61508 (Functional Safety of Electrical/Electronic/Programmable Electronic Safety-related Systems).
2. **No Physical Actuation:** CoalGuard does not send physical relay commands to emergency trip conveyors, activate nitrogen deluge systems, or start booster water pumps. All operator response actions (`monitor`, `inspect`, `cool`, `stop`) are purely simulated in software.
3. **No Direct Site Alarm Transfer:** Demonstration membership functions and numerical thresholds must not be transcribed into programmable logic controllers (PLCs) or distributed control systems (DCS) on an operational industrial site.
4. **Topology Score Is Not a Safety Rating:** The architecture page reports whether modeled directed connections exist. Its percentage is only a graph-connectivity summary; it is not a Safety Integrity Level (SIL) assessment and does not enforce or block equipment commands.

---

## 2. Process & Sensor Modeling Constraints

1. **Physics-Inspired vs. Full CFD:**
   The simulation uses a lumped-parameter thermal accumulation and Gaussian spatial diffusion model. While it captures realistic cause-and-effect relationships (heat retention, convective cooling, oxidation kinetics, and distance attenuation), it is not a 3D Navier-Stokes computational fluid dynamics (CFD) simulation or a finite-element porous media model.
2. **Coal Rank Heterogeneity:**
   Real coal exhibits enormous chemical variation depending on moisture, ash, volatile matter, fixed carbon, and petrographic maceral composition (vitrinite vs. inertinite). Real-world applications require proximate/ultimate chemical analyses and crossing-point temperature (CPT) laboratory testing for each specific coal seam.
3. **Virtual Telemetry:**
   All sensor streams (temperature, CO, vibration, current, dust, airflow, oxygen, methane) are synthesized using pseudo-random Gaussian noise and deterministic equations. Sensor degradation and network dropouts are simulated; they do not represent real RS-485 Modbus or WirelessHART radio interference.

---

## 3. What Would Be Required for Industrial Production?

To transition this decision-support concept into an operational industrial deployment, the following engineering steps would be mandatory:

1. **Hardware & Sensing Infrastructure:**
   - Multi-spectrum optical flame and infrared pyrometers rated for ATEX / IECEx Zone 20/21 hazardous combustible dust atmospheres.
   - Electrochemical or NDIR multi-gas aspirating sniffer tubes installed along enclosed conveyor galleries and transfer hoods.
   - Fiber-optic distributed temperature sensing (DTS) lines routed along the entire length of the conveyor structure.
2. **Hardware-in-the-Loop & Fail-Safe Architecture:**
   - Redundant, dual-channel fail-safe PLC architecture achieving SIL 2 or SIL 3 functional safety.
   - Hardwired emergency stops (e-stops) and pull-cord trip switches independent of any software decision engine.
3. **Historical Data Calibration:**
   - Training PSO and fuzzy rules on thousands of hours of labelled historical SCADA logs from real coal terminal operations.
4. **Cybersecurity & Industrial Protocol Integration:**
   - Secure industrial gateway integration via OPC-UA, MQTT with TLS 1.3, and Modbus TCP.
   - Role-based access control (RBAC) and tamper-proof audit trails for operator acknowledgments.

---

## 4. Research Roadmap & Extensions

- [ ] **Multi-Agent Swarm Rover Routing:** Simulating multiple autonomous inspection drones collaborating to locate subsurface hotspots across 100,000-tonne stockpile yards.
- [ ] **Neuro-Fuzzy (ANFIS) Online Adaptation:** Incorporating adaptive network fuzzy inference to fine-tune membership functions online as coal shipment batches change.
- [ ] **Satellite Telemetry Layer:** Ingesting live GeoTIFF thermal anomaly data from NASA FIRMS VIIRS for regional open-cast stockpile monitoring.
