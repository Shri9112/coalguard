# CoalGuard: Comprehensive Student Guide

## Explainable Multi-Sensor Coal Fire Risk Assessment using Soft Computing

---

## 1. Introduction & Academic Purpose

CoalGuard is an educational prototype developed for applied Soft Computing coursework. It demonstrates how uncertain, distributed sensor observations across industrial bulk coal operations can be combined into an **explainable, deterministic early-warning decision**.

### The Real-World Engineering Problem
Coal reacts exothermically with oxygen even at ambient temperatures ($25^\circ\text{C} - 45^\circ\text{C}$). If convective ventilation removes the generated heat faster than it accumulates, the material remains in equilibrium. However, if heat retention exceeds dissipation—such as inside a compacted stockpile core, a clogged transfer chute, or an unventilated ship cargo hold—an accelerating feedback loop takes place:
$$\text{Temperature Rise} \implies \text{Faster Oxidation Kinetics} \implies \text{Higher Heat Generation} \implies \text{Runaway Combustion}$$

In addition, coal handling systems face **mechanical fire hazards**:
- Seized idler roller bearings creating intense frictional heating along conveyor belts.
- Belt misalignment rubbing against structural steel frames.
- Chute packing causing drive motor overcurrent and slippage.

### Why Fixed Thresholds Fail
Traditional safety systems rely on fixed cutoff alarms (e.g., *Alarm if Temperature > 60 °C*). In industrial coal handling, this produces severe limitations:
1. **False Alarms:** High airborne dust from dry coal dumping or steam from water sprays trips optical sensors without any combustion present.
2. **Delayed Detection:** A slow, deep smolder may only raise ambient conveyor gallery temperature by 3 °C while generating significant carbon monoxide ($CO$). A single temperature threshold completely misses this onset window.
3. **Hidden Hotspots:** Rainfall or surface dust suppression cools the outer 10 cm of a coal pile, masking dangerous internal self-heating occurring 2 meters below the surface.

Soft Computing provides the formal mathematical tools to represent and resolve these uncertainties.

---

## 2. Genuine Mamdani Fuzzy Inference System (FIS)

CoalGuard implements a mathematically rigorous, fully inspectable Mamdani Fuzzy Inference System following four classical stages.

### Stage 1: Mathematical Fuzzification
Crisp physical inputs $x$ are transformed into continuous membership degrees $\mu(x) \in [0, 1]$ across linguistic terms: $\{\text{Low}, \text{Medium}, \text{High}, \text{VeryHigh}\}$.

#### Triangular Membership Function:
$$\mu_{\text{tri}}(x; a, b, c) = \begin{cases}
0, & x \le a \\
\frac{x - a}{b - a}, & a < x \le b \\
\frac{c - x}{c - b}, & b < x < c \\
0, & x \ge c
\end{cases}$$

#### Trapezoidal Membership Function:
$$\mu_{\text{trap}}(x; a, b, c, d) = \begin{cases}
0, & x \le a \\
\frac{x - a}{b - a}, & a < x \le b \\
1, & b < x \le c \\
\frac{d - x}{d - c}, & c < x < d \\
0, & x \ge d
\end{cases}$$

Boundary terms use left-shoulder functions (for Low baselines) and right-shoulder functions (for High/Critical escalations):
$$\mu_{\text{left}}(x; a, b) = \begin{cases} 1, & x \le a \\ \frac{b - x}{b - a}, & a < x < b \\ 0, & x \ge b \end{cases}, \quad \mu_{\text{right}}(x; a, b) = \begin{cases} 0, & x \le a \\ \frac{x - a}{b - a}, & a < x < b \\ 1, & x \ge b \end{cases}$$

---

### Stage 2: Explicit IF–THEN Rule Base Evaluation
CoalGuard evaluates ten inspectable rules. Antecedents connected by **AND** use the fuzzy minimum operator ($\min$); antecedents connected by **OR** use the fuzzy maximum operator ($\max$). R09 and R10 use absolute thermal and gas evidence so the risk does not incorrectly return to Normal just because the rate of rise slows while the readings remain elevated:

| Code | Rule Formula | Antecedents & Operator | Consequent Level & Output Fuzzy Set |
|---|---|---|---|
| **R01** | Multi-indicator runaway heating | $\mu_{\text{tempHigh}} \wedge \mu_{\text{trendHigh}} \wedge \mu_{\text{coHigh}}$ | Critical Risk: Trapezoid $[70, 85, 100, 100]$ |
| **R02** | Thermal rate-of-rise onset | $\mu_{\text{tempHigh}} \wedge \mu_{\text{trendHigh}}$ | Warning Risk: Triangle $[45, 62, 80]$ |
| **R03** | Deep oxidation gas buildup | $\mu_{\text{coHigh}} \wedge \mu_{\text{tempMed}}$ | Warning Risk: Triangle $[45, 62, 80]$ |
| **R04** | Mechanical bearing/belt friction | $(\mu_{\text{vibHigh}} \vee \mu_{\text{currHigh}}) \wedge \mu_{\text{coLow}}$ | Watch Risk: Triangle $[20, 38, 55]$ (Cause: Mechanical) |
| **R05** | Dust / steam interference check | $\mu_{\text{dustHigh}} \wedge \mu_{\text{coLow}} \wedge \mu_{\text{trendLow}}$ | Watch Risk: Triangle $[20, 38, 55]$ (Dampens Confidence) |
| **R06** | Hidden hotspot under wet surface | $(\mu_{\text{coHigh}} \vee \mu_{\text{trendHigh}}) \wedge \mu_{\text{tempLow}}$ | Warning Risk: Triangle $[45, 62, 80]$ |
| **R07** | Sensor network degradation | $\mu_{\text{healthDegraded}}$ | Telemetry Warning (Dampens Confidence) |
| **R08** | Normal baseline stability | $\mu_{\text{tempLow}} \wedge \mu_{\text{coLow}} \wedge \mu_{\text{trendLow}}$ | Normal Risk: Trapezoid $[0, 0, 15, 30]$ |
| **R09** | Sustained high temperature with elevated oxidation gas | $\mu_{\text{tempHigh}} \wedge \mu_{\text{coElevated}}$ | Warning Risk: Triangle $[45, 62, 80]$ |
| **R10** | Sustained severe thermal and gas evidence | $\mu_{\text{tempHigh}} \wedge \mu_{\text{coHigh}}$ | Critical Risk: Trapezoid $[70, 85, 100, 100]$ |

Each rule's firing strength $\alpha_k$ is calculated directly from its antecedents:
$$\alpha_k = w_k \cdot \min_{i} (\mu_{A_{k,i}}(x_i))$$
where $w_k$ is the rule's calibrated weight.

---

### Stage 3: Mamdani Min Implication & Max Aggregation
Rule consequence is obtained by clipping each rule's output membership function $\mu_{C_k}(z)$ at its firing level $\alpha_k$:
$$\mu_{C'_k}(z) = \min(\alpha_k, \mu_{C_k}(z))$$

The aggregated fuzzy output distribution $\mu_{\text{agg}}(z)$ across the risk score universe of discourse $z \in [0, 100]$ is computed as the union (maximum) of all active rule implications:
$$\mu_{\text{agg}}(z) = \max_{k=1}^K \mu_{C'_k}(z), \quad \forall z \in [0, 100]$$

---

### Stage 4: Centroid Defuzzification (Center of Area)
To obtain a crisp 0–100 risk score $z^*$, the application evaluates the discrete center-of-gravity integration:
$$z^* = \frac{\int_{0}^{100} z \cdot \mu_{\text{agg}}(z) \, dz}{\int_{0}^{100} \mu_{\text{agg}}(z) \, dz} \approx \frac{\sum_{i=0}^{100} z_i \cdot \mu_{\text{agg}}(z_i)}{\sum_{i=0}^{100} \mu_{\text{agg}}(z_i)}$$

The crisp score $z^*$ maps to documented educational severity bands:
- **Normal (0 – 25):** Operating parameters within baseline equilibrium.
- **Watch (26 – 50):** Developing signal divergence under observation; dispatch mobile rover.
- **Warning (51 – 75):** Actionable multi-sensor anomaly; activate spray deluge cooling.
- **Critical (76 – 100):** Urgent runaway self-heating signature; emergency conveyor isolation.

---

## 3. Real Particle Swarm Optimization (PSO) Calibration

Unlike trivial hardcoded vectors, CoalGuard features an authentic offline Particle Swarm Optimization algorithm that calibrates fuzzy membership breakpoints and rule weights against labelled synthetic scenarios.

### Swarm State Vector
Each particle $i \in \{1, \dots, N_p\}$ represents a candidate parameter set $\mathbf{x}_i \in \mathbb{R}^{11}$:
$$\mathbf{x}_i = [T_{\text{highA}}, T_{\text{highB}}, \Delta T_{\text{highA}}, \Delta T_{\text{highB}}, CO_{\text{highA}}, CO_{\text{highB}}, V_{\text{highA}}, V_{\text{highB}}, w_{\text{therm}}, w_{\text{mech}}, w_{\text{interf}}]$$

### Velocity & Position Update Equations
$$\mathbf{v}_i(t+1) = w(t) \cdot \mathbf{v}_i(t) + c_1 r_1 (\mathbf{p}_i - \mathbf{x}_i(t)) + c_2 r_2 (\mathbf{g}^* - \mathbf{x}_i(t))$$
$$\mathbf{x}_i(t+1) = \mathbf{x}_i(t) + \mathbf{v}_i(t+1)$$
where:
- $\mathbf{p}_i$ is particle $i$'s personal-best position.
- $\mathbf{g}^*$ is the global-best position across the entire swarm.
- $w(t)$ is linearly decreasing inertia weight: $w(t) = w_{\max} - \frac{t}{T_{\max}} (w_{\max} - w_{\min})$ with $w_{\max} = 0.85, w_{\min} = 0.40$.
- $c_1 = 1.6$ (cognitive acceleration coefficient), $c_2 = 1.9$ (social acceleration coefficient).
- $r_1, r_2 \sim U(0, 1)$ generated by a seeded Mulberry32 PRNG.
- Velocity is clamped: $|v_{i,d}| \le V_{\max, d} = 0.25 (U_d - L_d)$.

### Objective Function $J(\theta)$
The swarm optimizes an objective function designed to minimize prediction error while heavily penalizing false alarms during dust or steam interference:
$$J(\theta) = \frac{1}{M} \sum_{m=1}^M \left( z^*(\mathbf{s}_m; \theta) - y_m \right)^2 + \lambda_{\text{FA}} \sum_{m \in \text{Interference}} \max\left(0, z^*(\mathbf{s}_m; \theta) - 35\right)^2 + \text{Penalty}_{\text{inversion}}$$
where $\lambda_{\text{FA}} = 4.5$ aggressively suppresses nuisance trips during conveyor dust events.

---

## 4. Fair Algorithmic Model Comparison

CoalGuard compares three models on identical input scenario traces:

1. **Fixed-Threshold Baseline:** Rigid cutoffs ($T > 55^\circ\text{C}$ or $CO > 25\text{ ppm}$).
2. **Basic Mamdani FIS:** Uncalibrated heuristic membership breakpoints.
3. **PSO-Tuned Mamdani FIS:** Swarm-calibrated breakpoints and interference suppression weights.

### Derived Metrics
All metrics are derived mathematically from actual predictions against synthetic ground-truth labels:
- **False Alarm Rate (FPR):** $\text{FPR} = \frac{FP}{FP + TN} \times 100\%$
- **Precision:** $\frac{TP}{TP + FP} \times 100\%$
- **Recall (Sensitivity):** $\frac{TP}{TP + FN} \times 100\%$
- **F1 Score:** $2 \cdot \frac{\text{Precision} \cdot \text{Recall}}{\text{Precision} + \text{Recall}}$
- **Detection Delay:** Mean simulation ticks from true hazard onset until the first issued alert ($z^* \ge 51$).
- **Noise Robustness:** Ratio of F1 score retained under 25% Gaussian noise and 20% sensor dropout.

---

## 5. Summary of Limitations

1. **Academic Decision-Support Prototype:** Not certified for life-critical plant safety; does not control real equipment.
2. **Simulated Telemetry:** Sensor values and network states are synthetic; they must not be presented as industrial measurements.
3. **Digital Twin Boundary:** While physics-inspired, it is not a calibrated computational-fluid-dynamics (CFD) digital twin.
