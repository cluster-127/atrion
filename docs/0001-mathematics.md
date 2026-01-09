# Matematiksel Formalizasyon ve Tanımlar

## Mathematical Formalization of Conditioned Deterministic Orchestration

Bu bölüm, CDO modelinin temelini oluşturan vektörel durum uzayını (state space), hareket denklemlerini (equations of motion) ve kontrol yasalarını (control laws) tanımlar. Sistem, **Ayrık Zamanlı Dinamik Sistem (Discrete-Time Dynamical System)** olarak modellenmiştir.

---

### 1. Durum Uzayı (State Space Definitions)

Sistemdeki her bir yönlendirme yolu (route/edge) $r_i$, $t$ zaman anında aşağıdaki durum vektörleri ile tanımlanır:

#### 1.1. Basınç Vektörü (Pressure Vector)

Sistem üzerindeki anlık stres yükü, skaler bir değer değil, 3 boyutlu bir vektör uzayıdır ($\mathbb{R}^3$).

$$
\vec{P}_i(t) = \begin{bmatrix} p_{lat} \\ p_{err} \\ p_{sat} \end{bmatrix}
$$

* $p_{lat} \in [0, 1]$: Normalize edilmiş Gecikme Basıncı (Latency / MaxLatency).
* $p_{err} \in [0, 1]$: Hata Yoğunluğu (Error Rate).
* $p_{sat} \in [0, 1]$: Kaynak Doygunluğu (Queue Depth / MaxQueue).

#### 1.2. Ağırlık Matrisi (Sensitivity Matrix)

Her servisin basınca duyarlılığı farklıdır. Bu duyarlılık diyagonal bir ağırlık matrisi ile ifade edilir:

$$
\mathbf{W}_i = \text{diag}(w_{lat}, w_{err}, w_{sat})
$$

Burada $\sum w = 1$ olmak zorunda değildir; sistemin karakteristiğine (Latency-sensitive vs. Consistency-sensitive) göre ayarlanır.

---

### 2. Kinematik Denklemler (Kinematics)

Sistem reaktif değil proaktiftir; bu nedenle sadece konuma (basınca) değil, hıza (momentuma) da bakar.

#### 2.1. Momentum (Değişim İvmesi)

Basınç vektörünün zamana göre birinci türevi (ayrık zamanda farkı), sistemin gidişatını belirler.

$$
\vec{M}_i(t) = \frac{\vec{P}_i(t) - \vec{P}_i(t-1)}{\Delta t}
$$

Momentumun büyüklüğü (magnitude), sistemin "kriz hızı"nı gösterir:

$$
\|\vec{M}_i(t)\| = \sqrt{(\Delta p_{lat})^2 + (\Delta p_{err})^2 + (\Delta p_{sat})^2}
$$

* **Pozitif Diverjans:** $\vec{P}(t) \cdot \vec{M}(t) > 0$ (Sistem kötüye gidiyor, fren yapılmalı).
* **Negatif Diverjans:** $\vec{P}(t) \cdot \vec{M}(t) < 0$ (Sistem iyileşiyor, sönümleme azaltılabilir).

---

### 3. Topolojik Hafıza: Skar ve Entropi (Topology & Entropy)

Geçmiş travmaların sistemde bıraktığı yapısal iz, **Skar Fonksiyonu $S(t)$** ile modellenir.

#### 3.1. Skar Birikimi ve Çürüme (Accumulation & Decay)

Skar dokusu, kritik bir eşik ($P_{crit}$) aşıldığında artar, normal durumda ise entropi gereği zamanla sönümlenir.

$$
S_i(t) = \underbrace{S_i(t-1) \cdot e^{-\lambda \Delta t}}_{\text{Entropy / Decay}} + \underbrace{\sigma \cdot \mathbb{I}(\|\vec{P}_i(t)\| > P_{crit})}_{\text{Trauma / Scarring}}
$$

* $\lambda$: Çürüme sabiti (Decay constant). Yüksek $\lambda$, çabuk unutan (forgiving) sistem demektir.
* $\sigma$: Travma katsayısı (Scar factor). Her kritik hatanın bıraktığı izin ağırlığı.
* $\mathbb{I}(\cdot)$: İndikatör fonksiyonu (Koşul sağlanıyorsa 1, değilse 0).

---

### 4. Empedans Yasası (The Law of Impedance)

Sistemin akışa gösterdiği toplam direnç ($R_{total}$), statik, dinamik ve tarihsel bileşenlerin toplamıdır. Bu, CDO'nun "Ohm Yasası"dır.

$$
R_i(t) = R_{base} + \underbrace{(\vec{P}_i(t)^T \mathbf{W}_i)}_{\text{Instant Stress}} + \underbrace{\mu \|\vec{M}_i(t)\|}_{\text{Damping}} + \underbrace{S_i(t)}_{\text{History}}
$$

* $R_{base}$: Yolun topolojik baz maliyeti.
* $\mu$: Sönümleme katsayısı (Damping coefficient). Osilasyonu önlemek için momentumun dirence etkisini ayarlar.
* **Açıklama:** Eğer Momentum ($\vec{M}$) yüksekse, anlık stres ($\vec{P}$) düşük olsa bile $R_{total}$ fırlar. Bu, "Duvara çarpmadan fren yapma" mekanizmasıdır.

---

### 5. Akış Kararı (Flow Condition)

Bir işlemin ($req$) sistemden geçip geçemeyeceği, işlemin potansiyel enerjisi (Voltaj) ile yolun empedansı arasındaki eşitsizlikle belirlenir.

$$
\text{Flow}(req, r_i) = \begin{cases} 1 (Pass), & \text{if } V(req) > R_i(t) \\ 0 (Reject/Redir), & \text{if } V(req) \leq R_i(t) \end{cases}
$$

Burada $V(req)$, işlemin önceliğidir (Priority/Voltage):

* $V_{critical} \gg R_{max}$ (Kritik işlemler yüksek direnci yenebilir).
* $V_{background} \ll R_{base}$ (Arkaplan işlemleri en ufak dirençte düşer).

---

### 6. Kararlılık Analizi (Stability - Lyapunov Candidate)

Sistemin kaosa sürüklenmemesi için toplam enerjisinin zamanla azalması veya dengede kalması gerekir. Önerilen Lyapunov fonksiyonu adayı:

$$
L(t) = \sum_{i} \left( \|\vec{P}_i(t)\|^2 + \alpha S_i(t)^2 \right)
$$

Sistemin kararlı (stable) olması için $\Delta L(t) \leq 0$ koşulu, $\lambda$ (decay) ve $\mu$ (damping) parametrelerinin doğru seçimine bağlıdır.

---

### Özet: Parametre Sözlüğü

| Sembol | Tanım | Birim / Aralık | Rolü |
| :--- | :--- | :--- | :--- |
| $\vec{P}$ | Basınç Vektörü | $[0, 1]^3$ | Sistemin anlık yükünü ifade eder. |
| $\vec{M}$ | Momentum | $\mathbb{R}$ | Hatanın artış hızını (ivmesini) gösterir. |
| $S$ | Skar Dokusu | $[0, \infty)$ | Geçmiş hataların yarattığı yapısal direnç. |
| $R$ | Empedans | $[0, \infty)$ | Akışa karşı gösterilen toplam zorluk. |
| $\lambda$ | Entropi Sabiti | $(0, 1)$ | Sistemin unutma hızı. |
| $\mu$ | Damping Sabiti | $[0, \infty)$ | Sistemin ani değişimlere direnci (Fren sertliği). |
