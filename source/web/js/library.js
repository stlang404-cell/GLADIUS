// Game library: storage helpers and robust multi-game PGN import.
import { Chess } from '../vendor/chess.js';
import * as store from './store.js';

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export function addGame(g) {
  const game = Object.assign({ id: store.uid('g'), source: 'import', date: store.today(), white: '?', black: '?', result: '*', tags: {}, review: null, added: new Date().toISOString() }, g);
  store.update((s) => { s.games.unshift(game); });
  store.logActivity('games');
  store.save();
  return game;
}

export function getGame(id) { return store.get().games.find((g) => g.id === id); }

export function updateGame(id, fn) { store.update((s) => { const g = s.games.find((x) => x.id === id); if (g) fn(g); }); }

export function deleteGame(id) { store.update((s) => { s.games = s.games.filter((g) => g.id !== id); }); }

// Split a PGN file into games (each starts at a tag section or a movetext after a blank line + result).
export function splitPgn(text) {
  const src = String(text || '').replace(/\r\n?/g, '\n').replace(/^﻿/, '');
  const games = [];
  let cur = [];
  let inMoves = false;
  for (const line of src.split('\n')) {
    const isTag = /^\s*\[\w+\s+".*"\]\s*$/.test(line);
    if (isTag && inMoves) { games.push(cur.join('\n')); cur = []; inMoves = false; }
    if (!isTag && line.trim() && !line.trim().startsWith('%')) inMoves = true;
    cur.push(line);
  }
  if (cur.join('').trim()) games.push(cur.join('\n'));
  return games.map((g) => g.trim()).filter(Boolean);
}

// Clean movetext: strip comments, variations (nested), NAGs and odd tokens chess.js may reject.
export function cleanPgn(pgn) {
  const lines = pgn.split('\n');
  const tags = lines.filter((l) => /^\s*\[\w+\s+".*"\]\s*$/.test(l));
  let moves = lines.filter((l) => !/^\s*\[\w+\s+".*"\]\s*$/.test(l)).join(' ');
  moves = moves.replace(/\{[^}]*\}/g, ' ').replace(/;[^\n]*/g, ' ');
  let prev;
  do { prev = moves; moves = moves.replace(/\([^()]*\)/g, ' '); } while (moves !== prev);
  moves = moves.replace(/\$\d+/g, ' ').replace(/[!?]+/g, '').replace(/(\d+)\.\.\./g, '$1. ').replace(/\s+/g, ' ').trim();
  return tags.join('\n') + '\n\n' + moves;
}

export function parseOne(pgn) {
  const c = new Chess();
  try {
    c.loadPgn(pgn, { strict: false });
  } catch (e) {
    c.loadPgn(cleanPgn(pgn), { strict: false });
  }
  const headers = c.getHeaders ? c.getHeaders() : c.header();
  const sans = c.history();
  const startFen = headers.FEN || START_FEN;
  if (!sans.length) throw new Error('no moves found');
  return { headers, sans, startFen, pgn: exportPgn(headers, startFen, sans, headers.Result || '*') };
}

export function importPgnText(text) {
  const out = { ok: [], errors: [] };
  splitPgn(text).forEach((g, i) => {
    try {
      const p = parseOne(g);
      const hd = p.headers;
      const game = addGame({ source: 'import', white: hd.White || '?', black: hd.Black || '?', result: hd.Result || '*',
        date: normDate(hd.Date) || store.today(), event: hd.Event || '', headers: hd, sans: p.sans, startFen: p.startFen, pgn: p.pgn });
      out.ok.push(game);
    } catch (e) {
      out.errors.push(`Game ${i + 1}: ${e.message || e}`);
    }
  });
  return out;
}

function normDate(d) {
  if (!d) return null;
  const m = d.match(/^(\d{4})\.(\d{2})\.(\d{2})$/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

export function exportPgn(headers, startFen, sans, result) {
  const c = new Chess(startFen);
  const hd = Object.assign({ Event: '?', Site: '?', Date: '????.??.??', Round: '?', White: '?', Black: '?' }, headers || {});
  hd.Result = result || hd.Result || '*';
  if (startFen && startFen !== START_FEN) { hd.SetUp = '1'; hd.FEN = startFen; }
  for (const [k, v] of Object.entries(hd)) if (v !== null && v !== undefined) c.setHeader(k, String(v));
  for (const s of sans) c.move(s);
  let pgn = c.pgn({ maxWidth: 80 });
  if (!/(1-0|0-1|1\/2-1\/2|\*)\s*$/.test(pgn)) pgn += ' ' + hd.Result;
  return pgn;
}

// Replay a game: returns positions [{fen, san, uci, color, moveNo}] where entry i is the position BEFORE ply i;
// the final element is the end position (san null).
export function positions(game) {
  const c = new Chess(game.startFen || START_FEN);
  const out = [];
  for (const san of game.sans) {
    const fen = c.fen();
    const moveNo = c.moveNumber();
    const color = c.turn();
    const m = c.move(san);
    out.push({ fen, san: m.san, uci: m.from + m.to + (m.promotion || ''), from: m.from, to: m.to, color, moveNo, after: c.fen() });
  }
  out.push({ fen: c.fen(), san: null });
  return out;
}

export function sampleGamePgn() {
  return `[Event "Sample club game"]
[Site "Training"]
[Date "2026.03.14"]
[White "Student"]
[Black "Opponent"]
[Result "0-1"]

1. e4 e5 2. Nf3 Nc6 3. Bc4 Nd4 4. Nxe5 Qg5 5. Nxf7 Qxg2 6. Rf1 Qxe4+ 7. Be2 Nf3# 0-1`;
}
