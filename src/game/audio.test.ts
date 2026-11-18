import test from 'node:test';
import assert from 'node:assert/strict';
import { AudioElementLike, TantrikAudioManager } from './audio';
import {
  MUSIC_TRACK_URLS,
  SFX_CLIP_URLS,
  STINGER_TRACK_URLS,
  VOICE_CLIP_URLS,
} from './assets';

interface MockAudioElement extends AudioElementLike {
  triggerEnded(): void;
  triggerError(): void;
}

function createMockAudioFactory(onStateChange?: () => void) {
  const createdByUrl = new Map<string, MockAudioElement[]>();

  const createAudio = (url: string): MockAudioElement => {
    let paused = true;
    const listeners = new Map<string, Set<() => void>>();

    const mock: MockAudioElement = {
      src: url,
      volume: 0,
      currentTime: 0,
      playbackRate: 1,
      get paused() {
        return paused;
      },
      set paused(v: boolean) {
        paused = v;
        onStateChange?.();
      },
      loop: false,
      preload: 'auto',
      async play() {
        paused = false;
        onStateChange?.();
      },
      pause() {
        paused = true;
        onStateChange?.();
      },
      addEventListener(type: string, listener: () => void) {
        if (!listeners.has(type)) {
          listeners.set(type, new Set());
        }
        listeners.get(type)!.add(listener);
      },
      removeEventListener(type: string, listener: () => void) {
        listeners.get(type)?.delete(listener);
      },
      triggerEnded() {
        paused = true;
        const set = listeners.get('ended');
        if (set) {
          for (const fn of set) fn();
        }
        onStateChange?.();
      },
      triggerError() {
        paused = true;
        const set = listeners.get('error');
        if (set) {
          for (const fn of set) fn();
        }
        onStateChange?.();
      },
    };

    const list = createdByUrl.get(url) ?? [];
    list.push(mock);
    createdByUrl.set(url, list);
    return mock;
  };

  return { createAudio, createdByUrl };
}

function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test('Approved background music, character voices, result stingers, and gameplay SFX point to local /assets/aistudio/ files (excluding bicycle bell)', () => {
  assert.equal(
    MUSIC_TRACK_URLS.tantrik_bell,
    '/assets/aistudio/Tantrik_Clean_Edit_7096205e.mp3'
  );
  assert.equal(
    MUSIC_TRACK_URLS.rakshasa_rite,
    '/assets/aistudio/Rakshasa_Clean_Edit_757d0aa3.mp3'
  );

  // Stingers
  assert.equal(
    STINGER_TRACK_URLS.player_victory,
    '/assets/aistudio/player_Victory_stinger_-The_Last_Temple_Bell_9339477a.mp3'
  );
  assert.equal(
    STINGER_TRACK_URLS.player_defeat,
    '/assets/aistudio/player_Defeat_stinger_-Curse_of_the_Mudradhaar_-_Stinger_a0ea1f99.mp3'
  );

  // Rakshasa & Tantrik voiceovers
  assert.equal(
    VOICE_CLIP_URLS.demon_1st_dialogue,
    '/assets/aistudio/demon_1st_dialogue_cfd5a1b2.mp3'
  );
  assert.equal(
    VOICE_CLIP_URLS.demon_first_angry,
    '/assets/aistudio/demon_first_angry_364913be.mp3'
  );
  assert.equal(
    VOICE_CLIP_URLS.demon_got_attacked,
    '/assets/aistudio/demon-got_-attacked_f6f5ed98.mp3'
  );
  assert.equal(
    VOICE_CLIP_URLS.demon_attacking,
    '/assets/aistudio/demon_attacking_8f770306.mp3'
  );
  assert.equal(
    VOICE_CLIP_URLS.demon_defeat,
    '/assets/aistudio/demon-_defeat_a6c97651.mp3'
  );
  assert.equal(
    VOICE_CLIP_URLS.demon_victory,
    '/assets/aistudio/demon_victory_63b1ecd8.mp3'
  );
  assert.equal(
    VOICE_CLIP_URLS.tantrik_1st_dialogue,
    '/assets/aistudio/tantric_1st_dialogue_b222685c.mp3'
  );
  assert.equal(
    VOICE_CLIP_URLS.tantrik_victory,
    '/assets/aistudio/tantric_victory_d83419a2.mp3'
  );
  assert.equal(
    VOICE_CLIP_URLS.tantrik_defeat,
    '/assets/aistudio/tantric_defeat_a52a1b82.mp3'
  );
  assert.equal(
    VOICE_CLIP_URLS.tantrik_got_attacked,
    '/assets/aistudio/tantrick_got_attacked_719d4723.mp3'
  );

  // Gameplay SFX
  assert.equal(
    SFX_CLIP_URLS.mudra_sparkle,
    '/assets/aistudio/mixkit-magic-sparkle-poof-hit-3082_cb2f7cf7.wav'
  );
  assert.equal(
    SFX_CLIP_URLS.rakshasa_fireball,
    '/assets/aistudio/mixkit-fireball-spell-1347_7cc57263.wav'
  );
  assert.equal(
    SFX_CLIP_URLS.tantrik_punch_hit,
    '/assets/aistudio/mixkit-impact-of-a-strong-punch-2155_f89ad165.mp3'
  );
  assert.equal(
    SFX_CLIP_URLS.ritual_choir_shine,
    '/assets/aistudio/mixkit-choir-magic-shine-658_0cda8e9a.wav'
  );
  assert.equal(
    SFX_CLIP_URLS.rakshasa_grunt_backup,
    '/assets/aistudio/Rakshasa_Grunt_Cleaned__3__4a64ae8f.mp3'
  );

  // Confirm bicycle bell is not used anywhere in SFX_CLIP_URLS
  for (const url of Object.values(SFX_CLIP_URLS)) {
    assert.equal(url.includes('mixkit-bike-magical-bell'), false);
  }
});

test('Full sequence: Intro -> Preparation -> Gameplay -> Pause -> Resume -> Victory/Defeat -> Return to Title with zero track overlap', async () => {
  let overlapDetected = false;
  let managerRef: TantrikAudioManager | null = null;

  const { createAudio, createdByUrl } = createMockAudioFactory(() => {
    if (managerRef) {
      const snap = managerRef.getSnapshot();
      if (snap.simultaneousPlaying) {
        overlapDetected = true;
      }
    }
  });

  const manager = new TantrikAudioManager({
    createAudio,
    fadeStepMs: 5,
    fadeOutDurationMs: 20,
    fadeInDurationMs: 20,
    pauseFadeDurationMs: 15,
    loopBreathDelayMs: 20,
    dialogueBreathingGapMs: 10,
  });
  managerRef = manager;

  // 0. Before user interaction: respects browser autoplay restriction
  manager.syncGameState('title');
  let snap = manager.getSnapshot();
  assert.equal(snap.unlocked, false);
  assert.equal(snap.tracks.tantrik_bell.paused, true);
  assert.equal(snap.tracks.rakshasa_rite.paused, true);

  // 1. Intro (Opening Screen): First user interaction starts The Tantrik's Bell
  manager.unlockFromUserGesture();
  await waitMs(40);
  snap = manager.getSnapshot();
  assert.equal(snap.unlocked, true);
  assert.equal(snap.activeTrack, 'tantrik_bell');
  assert.equal(snap.tracks.tantrik_bell.paused, false);
  assert.equal(snap.tracks.rakshasa_rite.paused, true);
  assert.equal(snap.tracks.tantrik_bell.volume, snap.musicVolume);

  // Advance simulated playback time on The Tantrik's Bell
  const tantrikInstance = createdByUrl.get(MUSIC_TRACK_URLS.tantrik_bell)![0];
  tantrikInstance.currentTime = 8.4;

  // 2. Camera Preparation: Interacting with camera setup continues The Tantrik's Bell without restarting
  manager.unlockFromUserGesture();
  await waitMs(20);
  snap = manager.getSnapshot();
  assert.equal(snap.activeTrack, 'tantrik_bell');
  assert.equal(snap.tracks.tantrik_bell.paused, false);
  assert.equal(snap.tracks.tantrik_bell.currentTime, 8.4);

  // 3. Entering Gameplay: Fades out The Tantrik's Bell and transitions into The Rakshasa's Rite
  manager.syncGameState('playing');
  await waitMs(70);
  snap = manager.getSnapshot();
  assert.equal(overlapDetected, false, 'Tracks must never play simultaneously');
  assert.equal(snap.activeTrack, 'rakshasa_rite');
  assert.equal(snap.tracks.tantrik_bell.paused, true);
  assert.equal(snap.tracks.tantrik_bell.volume, 0);
  assert.equal(snap.tracks.rakshasa_rite.paused, false);
  assert.equal(snap.tracks.rakshasa_rite.volume, snap.musicVolume);

  // Simulate gameplay progression to 27.6 seconds into The Rakshasa's Rite
  const rakshasaInstance = createdByUrl.get(MUSIC_TRACK_URLS.rakshasa_rite)![0];
  rakshasaInstance.currentTime = 27.6;

  // 4. Pause: Pauses gameplay music and preserves exact playback position
  manager.syncGameState('paused');
  await waitMs(35);
  snap = manager.getSnapshot();
  assert.equal(snap.tracks.rakshasa_rite.paused, true);
  assert.equal(snap.tracks.rakshasa_rite.currentTime, 27.6);
  assert.equal(snap.tracks.tantrik_bell.paused, true);

  // 5. Resume: Resumes The Rakshasa's Rite from the exact same position (27.6s)
  manager.syncGameState('playing');
  await waitMs(35);
  snap = manager.getSnapshot();
  assert.equal(snap.activeTrack, 'rakshasa_rite');
  assert.equal(snap.tracks.rakshasa_rite.paused, false);
  assert.equal(snap.tracks.rakshasa_rite.currentTime, 27.6);
  assert.equal(snap.tracks.rakshasa_rite.volume, snap.musicVolume);

  // 6. Victory / Defeat: Fades out gameplay track and stops so stingers have room
  manager.syncGameState('gameover');
  await waitMs(45);
  snap = manager.getSnapshot();
  assert.equal(snap.activeTrack, null);
  assert.equal(snap.tracks.tantrik_bell.paused, true);
  assert.equal(snap.tracks.rakshasa_rite.paused, true);
  assert.equal(snap.tracks.rakshasa_rite.volume, 0);

  // 7. Return to Title: Transitions cleanly back to The Tantrik's Bell
  manager.syncGameState('title');
  await waitMs(45);
  snap = manager.getSnapshot();
  assert.equal(snap.activeTrack, 'tantrik_bell');
  assert.equal(snap.tracks.tantrik_bell.paused, false);
  assert.equal(snap.tracks.rakshasa_rite.paused, true);
  assert.equal(snap.tracks.tantrik_bell.volume, snap.musicVolume);
  assert.equal(overlapDetected, false, 'Zero overlap across full lifecycle');

  // Verify only one instance per track was ever created
  assert.equal(createdByUrl.get(MUSIC_TRACK_URLS.tantrik_bell)?.length, 1);
  assert.equal(createdByUrl.get(MUSIC_TRACK_URLS.rakshasa_rite)?.length, 1);

  manager.dispose();
});

test('Encounter dialogue, gameplay SFX, character voices, Player Victory & Player Defeat sequences + stingers with music ducking and zero voice overlap', async () => {
  let dialogueOverlapDetected = false;
  let gruntOverlappedWithVoice = false;
  let managerRef: TantrikAudioManager | null = null;

  const { createAudio, createdByUrl } = createMockAudioFactory(() => {
    if (managerRef) {
      const snap = managerRef.getSnapshot();
      if (snap.simultaneousDialoguePlaying) {
        dialogueOverlapDetected = true;
      }
      if (snap.activeVoice !== null && snap.activeSfx.includes('rakshasa_grunt_backup')) {
        gruntOverlappedWithVoice = true;
      }
    }
  });

  const manager = new TantrikAudioManager({
    createAudio,
    fadeStepMs: 5,
    fadeOutDurationMs: 15,
    fadeInDurationMs: 15,
    duckFadeDurationMs: 10,
    stingerFadeInDurationMs: 15,
    dialogueBreathingGapMs: 10,
  });
  managerRef = manager;

  manager.unlockFromUserGesture();
  await waitMs(30);

  // Verify voice playbackRate is slightly faster (> 1.0x) and strictly < 1.25x (+0.25x max)
  let snap = manager.getSnapshot();
  assert.ok(snap.voicePlaybackRate > 1.0 && snap.voicePlaybackRate < 1.25);

  // 1. Initial encounter sequence: demon_1st_dialogue -> tantrik_1st_dialogue
  manager.startEncounterAudio();
  await waitMs(35);

  snap = manager.getSnapshot();
  assert.equal(snap.activeTrack, 'rakshasa_rite');
  assert.equal(snap.activeVoice, 'demon_1st_dialogue');
  assert.deepEqual(snap.queuedVoices, ['tantrik_1st_dialogue']);
  assert.equal(snap.isMusicDucked, true);
  assert.equal(manager.isInitialEncounterDialoguePlaying(), true);
  assert.ok(snap.tracks.rakshasa_rite.volume < snap.musicVolume);

  // Finish demon_1st_dialogue -> breathing gap -> starts tantrik_1st_dialogue
  const demon1stEl = createdByUrl.get(VOICE_CLIP_URLS.demon_1st_dialogue)![0];
  assert.equal(demon1stEl.playbackRate, snap.voicePlaybackRate);
  demon1stEl.triggerEnded();
  await waitMs(25);

  snap = manager.getSnapshot();
  assert.equal(snap.activeVoice, 'tantrik_1st_dialogue');
  assert.deepEqual(snap.queuedVoices, []);
  assert.equal(snap.isMusicDucked, true);
  assert.equal(manager.isInitialEncounterDialoguePlaying(), true);

  // Finish tantrik_1st_dialogue -> intro sequence completes, ritual_choir_shine SFX plays, and music restores volume
  const tantrik1stEl = createdByUrl.get(VOICE_CLIP_URLS.tantrik_1st_dialogue)![0];
  tantrik1stEl.triggerEnded();
  await waitMs(25);

  snap = manager.getSnapshot();
  assert.equal(snap.activeVoice, null);
  assert.equal(snap.introSequenceCompleted, true);
  assert.equal(snap.isMusicDucked, false);
  assert.equal(manager.isInitialEncounterDialoguePlaying(), false);
  assert.equal(snap.tracks.rakshasa_rite.volume, snap.musicVolume);
  assert.equal(snap.sfxPlayCounts.ritual_choir_shine, 1);

  // 2. First successful Mudra triggers mudra_sparkle SFX once + demon_first_angry voice once (never backup grunt)
  manager.handlePlayerMudraSuccess(1);
  // Rapid duplicate call within deduplication window must NOT trigger a second overlapping mudra_sparkle
  manager.playSfx('mudra_sparkle');
  await waitMs(15);

  snap = manager.getSnapshot();
  assert.equal(snap.sfxPlayCounts.mudra_sparkle, 1, 'Mudra sparkle triggered once per recognition');
  assert.equal(snap.activeVoice, 'demon_first_angry');
  assert.equal(snap.firstMudraAngryPlayed, true);
  assert.equal(snap.sfxPlayCounts.rakshasa_grunt_backup, 0, 'Backup grunt never plays over vocal line');

  // Calling playRakshasaDamageBackupGrunt while a voice is playing is blocked
  assert.equal(manager.playRakshasaDamageBackupGrunt(), false);

  const demonAngryEl = createdByUrl.get(VOICE_CLIP_URLS.demon_first_angry)![0];
  demonAngryEl.triggerEnded();
  await waitMs(280); // Wait past mudra_sparkle 260ms deduplication window

  // 3. Subsequent Mudra triggers mudra_sparkle + demon_got_attacked (and never repeats demon_first_angry)
  manager.handlePlayerMudraSuccess(2);
  await waitMs(15);
  snap = manager.getSnapshot();
  assert.equal(snap.sfxPlayCounts.mudra_sparkle, 2);
  assert.equal(snap.activeVoice, 'demon_got_attacked');
  assert.equal(snap.sfxPlayCounts.rakshasa_grunt_backup, 0);

  const demonHitEl = createdByUrl.get(VOICE_CLIP_URLS.demon_got_attacked)![0];
  demonHitEl.triggerEnded();
  await waitMs(20);

  // Verify backup grunt works when no voice is active
  assert.equal(manager.playRakshasaDamageBackupGrunt(), true);
  await waitMs(10);
  snap = manager.getSnapshot();
  assert.equal(snap.sfxPlayCounts.rakshasa_grunt_backup, 1);

  // 4. Rakshasa major attack triggers rakshasa_fireball + tantrik_punch_hit SFX and queues demon_attacking -> tantrik_got_attacked
  manager.handleRakshasaMajorAttack();
  await waitMs(15);
  snap = manager.getSnapshot();
  assert.equal(snap.sfxPlayCounts.rakshasa_fireball, 1);
  assert.equal(snap.sfxPlayCounts.tantrik_punch_hit, 1);
  assert.equal(snap.activeVoice, 'demon_attacking');
  assert.deepEqual(snap.queuedVoices, ['tantrik_got_attacked']);
  const demonAttackEl = createdByUrl.get(VOICE_CLIP_URLS.demon_attacking)![0];
  assert.ok(demonAttackEl.currentTime >= 0.06);

  // Complete demon_attacking -> transitions cleanly to tantrik_got_attacked
  demonAttackEl.triggerEnded();
  await waitMs(25);
  snap = manager.getSnapshot();
  assert.equal(snap.activeVoice, 'tantrik_got_attacked');

  // 5. Player Victory sequence preempts active gameplay voice:
  //    demon_defeat -> tantrik_victory -> player_victory stinger (once, loop=false)
  manager.triggerOutcomeSequence('victory');
  await waitMs(30);

  snap = manager.getSnapshot();
  assert.equal(snap.outcomeTriggered, 'victory');
  assert.equal(snap.activeTrack, null, 'Gameplay music faded out on victory');
  assert.equal(snap.tracks.rakshasa_rite.paused, true);
  assert.equal(snap.activeVoice, 'demon_defeat');
  assert.deepEqual(snap.queuedVoices, ['tantrik_victory']);
  assert.equal(snap.activeStinger, null, 'Stinger waits until outcome voices finish');

  // Complete demon_defeat -> starts tantrik_victory
  const demonDefeatEl = createdByUrl.get(VOICE_CLIP_URLS.demon_defeat)![0];
  demonDefeatEl.triggerEnded();
  await waitMs(25);

  snap = manager.getSnapshot();
  assert.equal(snap.activeVoice, 'tantrik_victory');
  assert.equal(snap.activeStinger, null);

  // Complete tantrik_victory -> fades into player_victory stinger once
  const tantrikVictoryEl = createdByUrl.get(VOICE_CLIP_URLS.tantrik_victory)![0];
  tantrikVictoryEl.triggerEnded();
  await waitMs(30);

  snap = manager.getSnapshot();
  assert.equal(snap.activeVoice, null);
  assert.equal(snap.activeStinger, 'player_victory');
  assert.equal(snap.stingerPlayCounts.player_victory, 1);
  assert.equal(snap.stingers.player_victory.paused, false);
  const victoryStingerEl = createdByUrl.get(STINGER_TRACK_URLS.player_victory)![0];
  assert.equal(victoryStingerEl.loop, false, 'Victory stinger must never loop');

  // Verify stinger finishes cleanly and stays stopped
  victoryStingerEl.triggerEnded();
  await waitMs(10);
  snap = manager.getSnapshot();
  assert.equal(snap.activeStinger, null);
  assert.equal(snap.stingers.player_victory.paused, true);

  // 6. Replay encounter & test Player Defeat sequence:
  //    tantrik_defeat -> demon_victory -> player_defeat stinger (once, loop=false)
  manager.startEncounterAudio();
  await waitMs(30);

  manager.triggerOutcomeSequence('defeat');
  await waitMs(30);

  snap = manager.getSnapshot();
  assert.equal(snap.outcomeTriggered, 'defeat');
  assert.equal(snap.activeVoice, 'tantrik_defeat');
  assert.deepEqual(snap.queuedVoices, ['demon_victory']);

  const tantrikDefeatEl = createdByUrl.get(VOICE_CLIP_URLS.tantrik_defeat)![0];
  tantrikDefeatEl.triggerEnded();
  await waitMs(25);

  snap = manager.getSnapshot();
  assert.equal(snap.activeVoice, 'demon_victory');

  const demonVictoryEl = createdByUrl.get(VOICE_CLIP_URLS.demon_victory)![0];
  demonVictoryEl.triggerEnded();
  await waitMs(30);

  snap = manager.getSnapshot();
  assert.equal(snap.activeVoice, null);
  assert.equal(snap.activeStinger, 'player_defeat');
  assert.equal(snap.stingerPlayCounts.player_defeat, 1);
  assert.equal(snap.stingers.player_defeat.paused, false);
  const defeatStingerEl = createdByUrl.get(STINGER_TRACK_URLS.player_defeat)![0];
  assert.equal(defeatStingerEl.loop, false, 'Defeat stinger must never loop');

  // 7. Returning to title immediately stops any active stinger, dialogue, or SFX
  manager.syncGameState('title');
  await waitMs(30);
  snap = manager.getSnapshot();
  assert.equal(snap.activeStinger, null);
  assert.equal(snap.stingers.player_defeat.paused, true);
  assert.equal(snap.activeVoice, null);
  assert.deepEqual(snap.activeSfx, []);
  assert.equal(snap.activeTrack, 'tantrik_bell');
  assert.equal(dialogueOverlapDetected, false, 'Two voice clips must never overlap');
  assert.equal(gruntOverlappedWithVoice, false, 'Backup grunt must never overlap with vocal dialogue');

  manager.dispose();
});

test('Music, Dialogue, and SFX volumes are configurable independently', async () => {
  const { createAudio } = createMockAudioFactory();
  const manager = new TantrikAudioManager({
    createAudio,
    fadeStepMs: 5,
    fadeInDurationMs: 10,
    fadeOutDurationMs: 10,
  });

  manager.unlockFromUserGesture();
  await waitMs(25);

  manager.setMusicVolume(0.45);
  manager.setSfxVolume(0.8);
  manager.setDialogueVolume(0.95);

  let snap = manager.getSnapshot();
  assert.equal(snap.musicVolume, 0.45);
  assert.equal(snap.sfxVolume, 0.8);
  assert.equal(snap.dialogueVolume, 0.95);
  assert.equal(snap.tracks.tantrik_bell.volume, 0.45);

  manager.setMuted(true);
  snap = manager.getSnapshot();
  assert.equal(snap.muted, true);
  assert.equal(snap.tracks.tantrik_bell.volume, 0);

  manager.setMuted(false);
  snap = manager.getSnapshot();
  assert.equal(snap.muted, false);
  assert.equal(snap.tracks.tantrik_bell.volume, 0.45);

  manager.dispose();
});

test('triggerVoiceLine(id) enforces dialogue priority and music ducking, and triggerResultStinger(stingerId) plays one-shot with music fade-out', async () => {
  const { createAudio, createdByUrl } = createMockAudioFactory();
  const manager = new TantrikAudioManager({
    createAudio,
    fadeStepMs: 5,
    fadeInDurationMs: 10,
    fadeOutDurationMs: 10,
    duckFadeDurationMs: 10,
    stingerFadeInDurationMs: 10,
    dialogueBreathingGapMs: 5,
  });

  manager.unlockFromUserGesture();
  manager.syncGameState('playing');
  await waitMs(35);

  // Triggering a voice line ducks background music
  assert.equal(manager.triggerVoiceLine('demon_first_angry'), true);
  await waitMs(20);
  let snap = manager.getSnapshot();
  assert.equal(snap.activeVoice, 'demon_first_angry');
  assert.equal(snap.isMusicDucked, true);
  assert.ok(snap.tracks.rakshasa_rite.volume < snap.musicVolume);

  // Lower-priority ordinary gameplay voice cannot interrupt demon_first_angry
  assert.equal(manager.triggerVoiceLine('demon_got_attacked'), false);
  assert.equal(manager.getSnapshot().activeVoice, 'demon_first_angry');

  // Higher-priority outcome voice preempts active gameplay voice immediately
  assert.equal(manager.triggerVoiceLine('demon_defeat'), true);
  await waitMs(15);
  snap = manager.getSnapshot();
  assert.equal(snap.activeVoice, 'demon_defeat');

  // Finish outcome voice -> music ducking releases
  const demonDefeatEl = createdByUrl.get(VOICE_CLIP_URLS.demon_defeat)![0];
  demonDefeatEl.triggerEnded();
  await waitMs(25);
  snap = manager.getSnapshot();
  assert.equal(snap.activeVoice, null);
  assert.equal(snap.isMusicDucked, false);

  // triggerResultStinger fades out background music and plays the stinger once (loop = false)
  assert.equal(manager.triggerResultStinger('player_victory'), true);
  // Duplicate call while active is rejected so stinger plays only once
  assert.equal(manager.triggerResultStinger('player_victory'), false);
  await waitMs(30);

  snap = manager.getSnapshot();
  assert.equal(snap.activeTrack, null);
  assert.equal(snap.tracks.rakshasa_rite.paused, true);
  assert.equal(snap.activeStinger, 'player_victory');
  assert.equal(snap.stingerPlayCounts.player_victory, 1);
  const stingerEl = createdByUrl.get(STINGER_TRACK_URLS.player_victory)![0];
  assert.equal(stingerEl.loop, false);

  manager.dispose();
});

