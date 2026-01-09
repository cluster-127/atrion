Madem "Brutally Honest" modundayız, süslü lafları bırakıp **Software Engineer** şapkasını takalım.

Bu sistemi kodlamak, tipik bir CRUD API veya React Frontend yazmaya benzemez. Bu bir **Oyun Motoru (Game Engine)** yazmaya benzer. Veritabanı yok, UI yok; sadece **State (Durum)**, **Loop (Döngü)** ve **Math (Matematik)** var.

TS/JS background'un ile bugün başlamak için ihtiyacın olan **"Starter Kit"** aşağıdadır.

---

### 1. Mimari Zihniyet: "Functional Core, Imperative Shell"

Bu sistemin kalbi (Core) dış dünyadan izole, saf matematik fonksiyonlarından oluşmalı. I/O (Network, Database) sadece dış kabukta (Shell) olmalı.

* **Core:** `(State, Input) => NewState` (Deterministik, Side-effect yok)
* **Shell:** `setInterval`, `HTTP Request`, `Logger` (Side-effect var)

---

### 2. Proje İskeleti (Scaffolding)

Klasik MVC yapısını unut. **ECS (Entity Component System)** benzeri bir yapı kuruyoruz.

```text
/src
  /core
    - types.ts        # Vektör ve State tanımları (DNA)
    - physics.ts      # Ohm Kanunu, Momentum, Decay formülleri
  /engine
    - registry.ts     # Route'ların tutulduğu In-Memory Store
    - loop.ts         # Kalp atışı (Tick mechanism)
  /simulation
    - scenario.ts     # Test senaryosu (Suni yük üretici)
    - index.ts        # Entry point (Network yok, sadece simülasyon)

```

---

### 3. Kodlamaya Başlangıç Noktası (The Code)

Hemen şu dosyaları oluşturarak başlayabilirsin. Bu kodlar, yazdığımız matematiksel modelin doğrudan TypeScript implementasyonudur.

#### Adım A: DNA'yı Tanımla (`src/core/types.ts`)

Burada nesne tabanlı (Class) değil, veri odaklı (Interface/Struct) gidiyoruz.

```typescript
// Vektörel Basınç (3D Vector)
export interface PressureVector {
  latency: number; // 0.0 - 1.0
  error: number;   // 0.0 - 1.0
  saturation: number; // 0.0 - 1.0
}

// Bir Route'un Anlık Fiziği
export interface RoutePhysics {
  // Durum
  currentPressure: PressureVector;

  // Türev (Hız)
  momentum: number;

  // Tarihçe (Yapısal)
  scarTissue: number;

  // Sonuç (Ohm Yasası Çıktısı)
  resistance: number;

  // Zamanlama
  lastUpdated: number;
}

// Konfigürasyon (Tuning Parametreleri)
export interface PhysicsConfig {
  decayRate: number;      // Lambda (Entropi)
  scarFactor: number;     // Sigma (Travma etkisi)
  dampingFactor: number;  // Mu (Fren sertliği)
  baseResistance: number; // R_base
}

```

#### Adım B: Fizik Motorunu Yaz (`src/core/physics.ts`)

Burası sistemin beyni. I/O yok, sadece matematik.

```typescript
import { RoutePhysics, PressureVector, PhysicsConfig } from './types';

// Vektör Büyüklüğü (Magnitude)
const magnitude = (v: PressureVector): number =>
  Math.sqrt(v.latency**2 + v.error**2 + v.saturation**2);

// Momentum Hesapla (Delta / Time)
export const calculateMomentum = (
  prev: PressureVector,
  curr: PressureVector
): number => {
  const delta = {
    latency: curr.latency - prev.latency,
    error: curr.error - prev.error,
    saturation: curr.saturation - prev.saturation
  };
  return magnitude(delta); // Yönü değil, değişim şiddeti önemli
};

// Ana Döngü Fonksiyonu (Pure Function)
export const updatePhysics = (
  state: RoutePhysics,
  newPressure: PressureVector,
  config: PhysicsConfig,
  now: number
): RoutePhysics => {

  // 1. Momentum Hesapla
  const momentum = calculateMomentum(state.currentPressure, newPressure);

  // 2. Skar Dokusu Yönetimi (Remodeling)
  // Eğer hata basıncı kritikse (>0.5) skar artır, değilse çürüt (decay)
  let newScar = state.scarTissue;
  if (newPressure.error > 0.5) {
    newScar += config.scarFactor;
  } else {
    newScar *= config.decayRate; // Exponential Decay
  }

  // 3. Direnç Hesabı (Ohm Kanunu)
  // R = Base + Pressure + (Momentum * Damping) + Scar
  const pressureMag = magnitude(newPressure);
  const totalResistance =
    config.baseResistance +
    pressureMag +
    (momentum * config.dampingFactor) +
    newScar;

  return {
    currentPressure: newPressure,
    momentum: momentum,
    scarTissue: newScar,
    resistance: totalResistance,
    lastUpdated: now
  };
};

```

#### Adım C: Simülasyonu Çalıştır (`src/simulation/index.ts`)

Network olmadan, konsolda sistemin nasıl "nefes aldığını" gör.

```typescript
import { updatePhysics } from '../core/physics';
import { RoutePhysics, PhysicsConfig } from '../core/types';

// Başlangıç Durumu
let routeState: RoutePhysics = {
  currentPressure: { latency: 0, error: 0, saturation: 0 },
  momentum: 0,
  scarTissue: 0,
  resistance: 0,
  lastUpdated: Date.now()
};

const config: PhysicsConfig = {
  baseResistance: 10,
  decayRate: 0.95,    // Her tick'te %5 iyileşme
  scarFactor: 5,      // Her hata +5 direnç ekler
  dampingFactor: 20   // Momentum etkisi (Çok sert fren)
};

// Simulation Loop (Her 100ms bir Tick)
let tick = 0;
setInterval(() => {
  tick++;

  // SENARYO: Tick 10-20 arasında sisteme "Error" enjekte et
  let inputError = 0;
  if (tick > 10 && tick < 20) inputError = 0.8;

  const newPressure = {
    latency: 0.1,
    error: inputError,
    saturation: 0.2
  };

  // Motoru Çalıştır
  routeState = updatePhysics(routeState, newPressure, config, Date.now());

  // Gözlemle (Console Plotter)
  console.log(
    `T:${tick} | ` +
    `Err:${inputError.toFixed(1)} | ` +
    `Mom:${routeState.momentum.toFixed(2)} | ` +
    `Scar:${routeState.scarTissue.toFixed(2)} | ` +
    `RESISTANCE: ${routeState.resistance.toFixed(2)}`
  );

}, 100);

```

---

### 4. Kullanılacak Araçlar (Tech Stack)

Sade tut. "Dependency Hell"den kaçın.

1. **Runtime:** `Node.js` (LTS) veya `Bun` (Hız için, native TS desteği var, öneririm).
2. **Test:** `Vitest`. (Fizik motorunu unit test ile doğrulamak zorundasın.  şu iken  bu çıkmalı diye.)
3. **Visualization:** `asciichart` kütüphanesi. Konsolda direnç grafiği çizdirmek için mükemmel.
4. **No-Database:** Redis, Mongo vs. kurma. Her şey RAM'de (in-memory) dönecek.

### Özet

Bu akşam yapman gereken tek şey:
Yukarıdaki kodu kopyala, bir `ts-node` projesi aç ve çalıştır.
Konsolda; **Error (Girdi)** kesildiği anda **Resistance (Çıktı)** değerinin hemen düşmediğini, yavaş yavaş sönümlendiğini (Decay) gözünle gör.

Eğer direnç hemen sıfıra düşüyorsa teorimiz yanlıştır. Eğer yavaşça düşüyorsa, **"Dijital Fizik"** çalışıyor demektir. Başarılar baboş.
