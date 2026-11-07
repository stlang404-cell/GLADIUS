import type { Rng } from '../core/rng';

// Latin naming: praenomen + nomen + cognomen for citizens, plus provincial
// naming traditions so the empire feels cosmopolitan.
const PRAENOMINA = ['Gaius', 'Lucius', 'Marcus', 'Publius', 'Quintus', 'Titus', 'Gnaeus', 'Aulus', 'Decimus', 'Sextus', 'Servius', 'Spurius', 'Tiberius', 'Manius', 'Numerius', 'Appius', 'Kaeso', 'Vibius'];
const NOMINA = ['Aelius', 'Aemilius', 'Antonius', 'Aurelius', 'Caecilius', 'Calpurnius', 'Cassius', 'Claudius', 'Cornelius', 'Domitius', 'Fabius', 'Flavius', 'Fulvius', 'Furius', 'Horatius', 'Julius', 'Junius', 'Licinius', 'Livius', 'Lucretius', 'Marius', 'Minucius', 'Mucius', 'Octavius', 'Papirius', 'Pompeius', 'Porcius', 'Postumius', 'Quinctius', 'Sempronius', 'Sergius', 'Servilius', 'Sulpicius', 'Terentius', 'Tullius', 'Valerius', 'Vergilius', 'Vipsanius', 'Annius', 'Atilius', 'Caelius', 'Didius', 'Herennius', 'Iunius', 'Laelius', 'Manlius', 'Nonius', 'Ovidius', 'Petronius', 'Plautius', 'Rutilius', 'Salvius', 'Sentius', 'Statilius', 'Ulpius', 'Valerius', 'Vettius', 'Vibius', 'Volusius', 'Seius'];
const COGNOMINA_M = ['Agricola', 'Albinus', 'Asina', 'Barbatus', 'Brutus', 'Caecus', 'Calvus', 'Camillus', 'Cato', 'Celer', 'Cicero', 'Cotta', 'Crassus', 'Dentatus', 'Drusus', 'Felix', 'Flaccus', 'Florus', 'Fronto', 'Gallus', 'Germanicus', 'Gracchus', 'Lentulus', 'Lepidus', 'Longinus', 'Lucullus', 'Macer', 'Magnus', 'Marcellus', 'Maximus', 'Metellus', 'Naso', 'Nerva', 'Paullus', 'Pius', 'Priscus', 'Pulcher', 'Regulus', 'Rufus', 'Sabinus', 'Scaevola', 'Scipio', 'Severus', 'Silanus', 'Strabo', 'Sulla', 'Tacitus', 'Varro', 'Varus', 'Verus', 'Vitulus', 'Corvus', 'Bassus', 'Balbus', 'Capito', 'Catulus', 'Dolabella', 'Faustus', 'Galba', 'Lupus', 'Messala', 'Nepos', 'Otho', 'Piso', 'Quietus', 'Saturninus', 'Secundus', 'Tertius', 'Urbicus', 'Valens', 'Vindex', 'Aquila', 'Leo', 'Ursus', 'Victor', 'Fortis', 'Clemens', 'Constans', 'Ferox'];
const COGNOMINA_F = ['Prisca', 'Secunda', 'Tertia', 'Maxima', 'Paulla', 'Rufa', 'Severa', 'Faustina', 'Lucilla', 'Marcella', 'Livilla', 'Agrippina', 'Domitilla', 'Drusilla', 'Felicitas', 'Galla', 'Lepida', 'Longina', 'Messalina', 'Pulchra', 'Sabina', 'Valentina', 'Vera', 'Aquilina', 'Clementia', 'Fortunata', 'Plautilla', 'Procula', 'Quintilla', 'Saturnina', 'Victoria', 'Iusta', 'Placida', 'Serena', 'Verecunda', 'Firmina', 'Celsa', 'Calvina'];

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

const EPITHETS = ['the Elder', 'the Younger', 'of Ostia', 'of Capua', 'of Neapolis', 'of Tarraco', 'of Lugdunum', 'of Corinth', 'of Antioch', 'of Carthage', 'of Alexandria', 'of Londinium', 'of Massilia', 'of Ravenna', 'of Pergamon', 'of Ephesus', 'of Gades', 'of Sirmium', 'of Treveri', 'of Leptis'];

export function generateName(rng: Rng, female: boolean, taken: Set<string>): { name: string; origin: string } {
  for (let attempt = 0; attempt < 50; attempt++) {
    const prov = pickProvince(rng);
    let name: string;
    const local = female ? prov.female : prov.male;
    if (local && rng.chance(0.75)) {
      name = rng.pick(local);
      if (rng.chance(0.6)) name += ' ' + rng.pick(EPITHETS);
      else name = (female ? feminize(rng.pick(NOMINA)) : rng.pick(NOMINA)) + ' ' + name;
    } else if (female) {
      name = feminize(rng.pick(NOMINA)) + ' ' + rng.pick(COGNOMINA_F);
    } else {
      name = rng.pick(PRAENOMINA) + ' ' + rng.pick(NOMINA) + ' ' + rng.pick(COGNOMINA_M);
    }
    if (attempt > 20) name += ' ' + rng.pick(EPITHETS);
    if (attempt > 40) name += ' ' + ['II', 'III', 'IV', 'V', 'VI'][rng.int(0, 5)];
    if (!taken.has(name)) {
      taken.add(name);
      return { name, origin: prov.name };
    }
  }
  const name = `Ignotus ${taken.size}`;
  taken.add(name);
  return { name, origin: 'Roma' };
}
