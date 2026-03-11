/** Norwegian first names — ~100 names, mix of male and female */
export const FIRST_NAMES = [
  // Male names
  'Anders', 'Bjørn', 'Christian', 'Daniel', 'Erik', 'Fredrik', 'Geir', 'Hans',
  'Ivar', 'Jan', 'Knut', 'Lars', 'Magnus', 'Nils', 'Olav', 'Petter',
  'Ragnar', 'Svein', 'Terje', 'Ulf', 'Vidar', 'Wilhelm', 'Yngvar', 'Øystein',
  'Arne', 'Bård', 'Dag', 'Eivind', 'Finn', 'Gunnar', 'Harald', 'Jon',
  'Kjell', 'Leif', 'Morten', 'Odd', 'Per', 'Rune', 'Sigurd', 'Thomas',
  'Vegard', 'Tore', 'Stein', 'Roar', 'Håkon', 'Espen', 'Trond', 'Kjetil',
  'Stian', 'Henrik',
  // Female names
  'Anne', 'Berit', 'Camilla', 'Dorthe', 'Eva', 'Frida', 'Grete', 'Hilde',
  'Ingrid', 'Julie', 'Kristin', 'Lise', 'Marit', 'Nina', 'Oddrun', 'Petra',
  'Ragnhild', 'Solveig', 'Tonje', 'Unni', 'Vibeke', 'Wenche', 'Ylva', 'Åse',
  'Astrid', 'Bente', 'Cecilie', 'Eli', 'Gunn', 'Heidi', 'Inger', 'Kari',
  'Line', 'Mona', 'Oddny', 'Randi', 'Siri', 'Tone', 'Vigdis', 'Anita',
  'Brit', 'Dagny', 'Elise', 'Gerd', 'Helene', 'Jorunn', 'Kirsten', 'Margit',
  'Sigrid', 'Turid',
];

/** Norwegian last names — ~80 names */
export const LAST_NAMES = [
  'Hansen', 'Johansen', 'Olsen', 'Larsen', 'Andersen', 'Pedersen', 'Nilsen',
  'Kristiansen', 'Jensen', 'Karlsen', 'Johnsen', 'Pettersen', 'Eriksen', 'Berg',
  'Haugen', 'Hagen', 'Johannessen', 'Andreassen', 'Jacobsen', 'Dahl', 'Jørgensen',
  'Henriksen', 'Lund', 'Halvorsen', 'Sørensen', 'Jakobsen', 'Moen', 'Gundersen',
  'Iversen', 'Overland', 'Strand', 'Solberg', 'Martinsen', 'Paulsen', 'Knutsen',
  'Eide', 'Bakken', 'Kristoffersen', 'Mathisen', 'Lie', 'Amundsen', 'Nguyen',
  'Rasmussen', 'Lunde', 'Solheim', 'Berge', 'Moe', 'Fredriksen', 'Nygård',
  'Bakke', 'Holm', 'Gabrielsen', 'Aas', 'Gulbrandsen', 'Brekke', 'Vik',
  'Stensrud', 'Ruud', 'Myhre', 'Simonsen', 'Nordseth', 'Knudsen', 'Ødegård',
  'Tangen', 'Fjeld', 'Vold', 'Aune', 'Dale', 'Berntsen', 'Thorsen',
  'Svendsen', 'Hovland', 'Ellingsen', 'Sandvik', 'Rønning', 'Vestby', 'Hauge',
  'Skoglund', 'Aasen', 'Sveen',
];

/** Deterministic name picker using seed-based index */
export function pickName(names: readonly string[], index: number): string {
  return names[index % names.length];
}
