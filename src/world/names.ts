import type { Rng } from '../core/rng';

// Latin naming: praenomen + nomen + cognomen for citizens, plus provincial
// naming traditions so the empire feels cosmopolitan.
const PRAENOMINA = ['Gaius', 'Lucius', 'Marcus', 'Publius', 'Quintus', 'Titus', 'Gnaeus', 'Aulus', 'Decimus', 'Sextus', 'Servius', 'Spurius', 'Tiberius', 'Manius', 'Numerius', 'Appius', 'Kaeso', 'Vibius'];
const NOMINA = ['Aelius', 'Aemilius', 'Antonius', 'Aurelius', 'Caecilius', 'Calpurnius', 'Cassius', 'Claudius', 'Cornelius', 'Domitius', 'Fabius', 'Flavius', 'Fulvius', 'Furius', 'Horatius', 'Julius', 'Junius', 'Licinius', 'Livius', 'Lucretius', 'Marius', 'Minucius', 'Mucius', 'Octavius', 'Papirius', 'Pompeius', 'Porcius', 'Postumius', 'Quinctius', 'Sempronius', 'Sergius', 'Servilius', 'Sulpicius', 'Terentius', 'Tullius', 'Valerius', 'Vergilius', 'Vipsanius', 'Annius', 'Atilius', 'Caelius', 'Didius', 'Herennius', 'Iunius', 'Laelius', 'Manlius', 'Nonius', 'Ovidius', 'Petronius', 'Plautius', 'Rutilius', 'Salvius', 'Sentius', 'Statilius', 'Ulpius', 'Vettius', 'Vibius', 'Volusius', 'Seius', 'Acilius', 'Afranius', 'Albius', 'Alfenus', 'Annaeus', 'Antistius', 'Apuleius', 'Aquillius', 'Arrius', 'Asinius', 'Aufidius', 'Avidius', 'Baebius', 'Betilienus', 'Caesius', 'Canuleius', 'Carvilius', 'Cispius', 'Cluentius', 'Cocceius', 'Coelius', 'Cominius', 'Considius', 'Coruncanius', 'Curius', 'Decius', 'Duilius', 'Egnatius', 'Fannius', 'Flaminius', 'Fonteius', 'Gabinius', 'Gavius', 'Gellius', 'Helvius', 'Hirtius', 'Hortensius', 'Hostilius', 'Iulius', 'Labienus', 'Lollius', 'Lucilius', 'Mamilius', 'Marcius', 'Memmius', 'Mettius', 'Naevius', 'Numisius', 'Oppius', 'Opimius', 'Orbilius', 'Pacuvius', 'Papius', 'Pedius', 'Petillius', 'Pinarius', 'Plancius', 'Plotius', 'Pomponius', 'Popillius', 'Quinctilius', 'Rabirius', 'Roscius', 'Rubrius', 'Scribonius', 'Sallustius', 'Scantius', 'Sextius', 'Sicinius', 'Silius', 'Sosius', 'Staius', 'Suetonius', 'Tarquitius', 'Titinius', 'Trebonius', 'Tullus', 'Valgius', 'Varius', 'Velleius', 'Ventidius', 'Verginius', 'Vettulenus', 'Vinicius', 'Visellius', 'Vitellius', 'Volumnius'];
const COGNOMINA_M = ['Agricola', 'Albinus', 'Asina', 'Barbatus', 'Brutus', 'Caecus', 'Calvus', 'Camillus', 'Cato', 'Celer', 'Cicero', 'Cotta', 'Crassus', 'Dentatus', 'Drusus', 'Felix', 'Flaccus', 'Florus', 'Fronto', 'Gallus', 'Germanicus', 'Gracchus', 'Lentulus', 'Lepidus', 'Longinus', 'Lucullus', 'Macer', 'Magnus', 'Marcellus', 'Maximus', 'Metellus', 'Naso', 'Nerva', 'Paullus', 'Pius', 'Priscus', 'Pulcher', 'Regulus', 'Rufus', 'Sabinus', 'Scaevola', 'Scipio', 'Severus', 'Silanus', 'Strabo', 'Sulla', 'Tacitus', 'Varro', 'Varus', 'Verus', 'Vitulus', 'Corvus', 'Bassus', 'Balbus', 'Capito', 'Catulus', 'Dolabella', 'Faustus', 'Galba', 'Lupus', 'Messala', 'Nepos', 'Otho', 'Piso', 'Quietus', 'Saturninus', 'Secundus', 'Tertius', 'Urbicus', 'Valens', 'Vindex', 'Aquila', 'Leo', 'Ursus', 'Victor', 'Fortis', 'Clemens', 'Constans', 'Ferox', 'Ahenobarbus', 'Atratinus', 'Bibulus', 'Brocchus', 'Caepio', 'Caldus', 'Carbo', 'Celsus', 'Cerialis', 'Cethegus', 'Cinna', 'Crispus', 'Curio', 'Dives', 'Fimbria', 'Flamininus', 'Frugi', 'Fuscus', 'Glabrio', 'Hispallus', 'Iustus', 'Laenas', 'Lamia', 'Longus', 'Macro', 'Mancinus', 'Marcianus', 'Maximinus', 'Mela', 'Mucianus', 'Murena', 'Natalis', 'Niger', 'Nobilior', 'Pansa', 'Pollio', 'Postumus', 'Probus', 'Pudens', 'Quadratus', 'Restitutus', 'Rufinus', 'Rusticus', 'Salinator', 'Serranus', 'Silvanus', 'Sura', 'Taurus', 'Torquatus', 'Tubero', 'Turrinus', 'Vatia', 'Verrucosus', 'Vitalis', 'Volusus'];
const COGNOMINA_F = ['Prisca', 'Secunda', 'Tertia', 'Maxima', 'Paulla', 'Rufa', 'Severa', 'Faustina', 'Lucilla', 'Marcella', 'Livilla', 'Agrippina', 'Domitilla', 'Drusilla', 'Felicitas', 'Galla', 'Lepida', 'Longina', 'Messalina', 'Pulchra', 'Sabina', 'Valentina', 'Vera', 'Aquilina', 'Clementia', 'Fortunata', 'Plautilla', 'Procula', 'Quintilla', 'Saturnina', 'Victoria', 'Iusta', 'Placida', 'Serena', 'Verecunda', 'Firmina', 'Celsa', 'Calvina', 'Prima', 'Quarta', 'Quinta', 'Albina', 'Balbina', 'Bassilla', 'Caecilla', 'Calpurnilla', 'Candida', 'Castula', 'Crispina', 'Domna', 'Fausta', 'Flaccilla', 'Fulvilla', 'Gratilla', 'Honorata', 'Ingenua', 'Iulilla', 'Laeta', 'Marciana', 'Matidia', 'Maximilla', 'Modesta', 'Nigrina', 'Paulina', 'Plotina', 'Polla', 'Procilla', 'Pudentilla', 'Quieta', 'Rufina', 'Rustica', 'Sabinilla', 'Salonina', 'Secundilla', 'Severina', 'Sulpicilla', 'Tertulla', 'Urbana', 'Urbica', 'Vitalis', 'Zenonis', 'Aemiliana', 'Antonina', 'Avita', 'Bona', 'Caesonia', 'Celerina', 'Clara', 'Cornificia', 'Donata', 'Emerita', 'Felicula', 'Florentina', 'Galeria', 'Hilaria', 'Iunilla', 'Lucretiana', 'Magna', 'Marina', 'Nonnita', 'Optata', 'Pacata', 'Perpetua', 'Primula', 'Regilla', 'Septimina', 'Spes', 'Tranquilla', 'Ursula', 'Valeriana', 'Venusta', 'Vincentia'];

type Province = { name: string; weight: number; male?: string[]; female?: string[] };

export const PROVINCES: Province[] = [
  { name: 'Roma', weight: 22 },
  { name: 'Italia', weight: 14 },
  { name: 'Hispania', weight: 7 },
  { name: 'Gallia', weight: 7, male: ['Vercingetorix', 'Ambiorix', 'Dumnorix', 'Orgetorix', 'Litavicus', 'Eporedorix', 'Cingetorix', 'Divico', 'Lugotorix', 'Segovax'], female: ['Epona', 'Brigantia', 'Rosmerta', 'Sirona', 'Belisama', 'Damona'] },
  { name: 'Britannia', weight: 4, male: ['Caratacus', 'Cunobelinus', 'Togodumnus', 'Prasutagus', 'Venutius', 'Calgacus', 'Cogidubnus', 'Mandubracius'], female: ['Boudica', 'Cartimandua', 'Camma', 'Verica', 'Riganta'] },
  { name: 'Germania', weight: 5, male: ['Arminius', 'Segestes', 'Maroboduus', 'Flavus', 'Inguiomerus', 'Catumerus', 'Italicus', 'Chariovalda', 'Gannascus'], female: ['Thusnelda', 'Veleda', 'Ganna', 'Hildis', 'Ramis'] },
  { name: 'Graecia', weight: 9, male: ['Alexandros', 'Demetrios', 'Nikolaos', 'Theodoros', 'Philippos', 'Herakleides', 'Kallias', 'Lysandros', 'Menandros', 'Sokrates', 'Xenophon', 'Diogenes', 'Leonidas', 'Aristides', 'Pericles', 'Timon', 'Zenon'], female: ['Aspasia', 'Hypatia', 'Theano', 'Agathe', 'Eirene', 'Kallisto', 'Melitta', 'Phoebe', 'Sappho', 'Thaleia', 'Zoe', 'Daphne'] },
  { name: 'Aegyptus', weight: 6, male: ['Ptolemaios', 'Amenhotep', 'Harsiese', 'Imhotep', 'Paneb', 'Petosiris', 'Sennefer', 'Horemheb', 'Khaemwaset', 'Nakhtnebef'], female: ['Arsinoe', 'Berenike', 'Kleopatra', 'Nefertari', 'Tiye', 'Meritamun', 'Isidora', 'Tauret'] },
  { name: 'Syria', weight: 5, male: ['Iamblichus', 'Malchus', 'Odaenathus', 'Zabdas', 'Sampsigeramus', 'Abgar', 'Hairan', 'Bar-Hadad'], female: ['Zenobia', 'Julia Domna', 'Maesa', 'Soaemias', 'Mamaea', 'Bathzabbai'] },
  { name: 'Africa', weight: 6, male: ['Hannibal', 'Hasdrubal', 'Hanno', 'Himilco', 'Mago', 'Bomilcar', 'Adherbal', 'Maharbal', 'Gisco'], female: ['Sophonisba', 'Elissa', 'Tanit', 'Arishat', 'Batbaal'] },
  { name: 'Numidia', weight: 3, male: ['Massinissa', 'Jugurtha', 'Juba', 'Syphax', 'Micipsa', 'Gulussa', 'Tacfarinas'], female: ['Tin Hinan', 'Dihya', 'Tamazgha', 'Tiziri'] },
  { name: 'Thracia', weight: 3, male: ['Spartacus', 'Rhoemetalces', 'Cotys', 'Seuthes', 'Teres', 'Sitalces', 'Rhescuporis'], female: ['Bendis', 'Kotiso', 'Polemonia'] },
  { name: 'Dacia', weight: 3, male: ['Decebalus', 'Burebista', 'Diurpaneus', 'Duras', 'Vezina', 'Comosicus'], female: ['Zia', 'Dida', 'Tsinna'] },
  { name: 'Persia', weight: 3, male: ['Arsaces', 'Mithridates', 'Phraates', 'Vologases', 'Orodes', 'Tiridates', 'Artabanus', 'Surena', 'Ardashir'], female: ['Musa', 'Roxana', 'Parysatis', 'Atossa', 'Artunis', 'Mandana'] },
  { name: 'Armenia', weight: 2, male: ['Tigranes', 'Artavasdes', 'Artaxias', 'Ervand', 'Vahagn'], female: ['Erato', 'Satenik', 'Anahit'] },
  { name: 'Judaea', weight: 2, male: ['Eleazar', 'Shimon', 'Yohanan', 'Mattathias', 'Yehuda', 'Menahem'], female: ['Salome', 'Miriam', 'Berenice', 'Mariamne', 'Shlomit'] },
  { name: 'Lusitania', weight: 2, male: ['Viriathus', 'Tautalus', 'Punicus', 'Caesarus'], female: ['Ataecina', 'Trebaruna'] },
  { name: 'Pannonia', weight: 2 },
];
const PROVINCE_TOTAL = PROVINCES.reduce((a, p) => a + p.weight, 0);

function pickProvince(rng: Rng): Province {
  let r = rng.next() * PROVINCE_TOTAL;
  for (const p of PROVINCES) {
    r -= p.weight;
    if (r <= 0) return p;
  }
  return PROVINCES[0];
}

function feminize(nomen: string): string {
  return nomen.endsWith('ius') ? nomen.slice(0, -3) + 'ia' : nomen.endsWith('us') ? nomen.slice(0, -2) + 'a' : nomen;
}

const EPITHETS = [
  'the Elder', 'the Younger', 'of Ostia', 'of Capua', 'of Neapolis', 'of Tarraco', 'of Lugdunum', 'of Corinth', 'of Antioch', 'of Carthage',
  'of Alexandria', 'of Londinium', 'of Massilia', 'of Ravenna', 'of Pergamon', 'of Ephesus', 'of Gades', 'of Sirmium', 'of Treveri', 'of Leptis',
  'of Florentia', 'of Arretium', 'of Pisae', 'of Puteoli', 'of Pompeii', 'of Brundisium', 'of Narbo', 'of Burdigala', 'of Colonia', 'of Emerita',
  'of Corduba', 'of Hippo', 'of Cirta', 'of Cyrene', 'of Memphis', 'of Thebes', 'of Palmyra', 'of Damascus', 'of Athenae', 'of Thessalonica',
  'of Sparta', 'of Delphi', 'of Byzantium', 'of Aquileia', 'of Verona', 'of Mediolanum', 'of Tibur', 'of Praeneste', 'of Tusculum', 'of Antium',
];

const FEM_COGNOMINA = [...new Set([...COGNOMINA_F, ...COGNOMINA_M.filter((c) => c.endsWith('us')).map((c) => c.slice(0, -2) + 'a')])];
const NUMERALS = ['II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

/** Rough count of distinct names the generator can produce (documented capacity check). */
export function nameCapacity(): { male: number; female: number } {
  return {
    male: PRAENOMINA.length * NOMINA.length * COGNOMINA_M.length * (1 + EPITHETS.length),
    female: NOMINA.length * FEM_COGNOMINA.length * (1 + FEM_COGNOMINA.length + EPITHETS.length),
  };
}

/**
 * Unique Roman-style name. Capacity (nameCapacity(): ≈ 18 M male, ≈ 5 M female combinations)
 * keeps collisions rare at 25k–50k competitors; on a collision the generator
 * retries, then adds a city epithet, then a numeral ("II"), so a name is never
 * reused while its holder is remembered (`taken` should include archived legends).
 */
export function generateName(rng: Rng, female: boolean, taken: Set<string>): { name: string; origin: string } {
  for (let attempt = 0; attempt < 60; attempt++) {
    const prov = pickProvince(rng);
    let name: string;
    const local = female ? prov.female : prov.male;
    if (local && rng.chance(0.6)) {
      name = rng.pick(local);
      if (rng.chance(0.5)) name += ' ' + rng.pick(EPITHETS);
      else name = (female ? feminize(rng.pick(NOMINA)) : rng.pick(NOMINA)) + ' ' + name;
    } else if (female) {
      name = feminize(rng.pick(NOMINA)) + ' ' + rng.pick(FEM_COGNOMINA);
      if (rng.chance(0.12)) name += ' ' + rng.pick(FEM_COGNOMINA);
    } else {
      name = rng.pick(PRAENOMINA) + ' ' + rng.pick(NOMINA) + ' ' + rng.pick(COGNOMINA_M);
    }
    if (attempt > 6) name += ' ' + rng.pick(EPITHETS);
    if (attempt > 30) name += ' ' + NUMERALS[rng.int(0, NUMERALS.length)];
    if (!taken.has(name)) {
      taken.add(name);
      return { name, origin: prov.name };
    }
  }
  let n = taken.size;
  while (taken.has(`Ignotus ${n}`)) n++;
  const name = `Ignotus ${n}`;
  taken.add(name);
  return { name, origin: 'Roma' };
}
