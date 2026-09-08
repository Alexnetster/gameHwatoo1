import { Game } from './game/Game';
import { EventBus } from './game/EventBus';
import { CardDef } from './game/types';
import { calculateScore, calculateScoreBreakdown } from './game/rules';
import { AssetManager } from './utils/AssetManager';

async function bootstrap() {
  const container = document.getElementById('game-container');
  const loadingScreen = document.getElementById('loading-screen');
  const statusBanner = document.getElementById('status-banner');
  const choiceModal = document.getElementById('choice-modal');
  const choiceCardsContainer = document.getElementById('choice-cards-container');
  const goStopModal = document.getElementById('go-stop-modal');
  const btnGo = document.getElementById('btn-go');
  const btnStop = document.getElementById('btn-stop');
  const resultModal = document.getElementById('result-modal');
  const captureNotice = document.getElementById('capture-notice');
  const btnRestart = document.getElementById('btn-restart');
  const playerScore = document.getElementById('player-score');
  const cpuScore = document.getElementById('cpu-score');

  // Player count tags
  const pGwang = document.getElementById('player-gwang');
  const pAnimal = document.getElementById('player-animal');
  const pRibbon = document.getElementById('player-ribbon');
  const pJunk = document.getElementById('player-junk');

  // CPU count tags
  const cGwang = document.getElementById('cpu-gwang');
  const cAnimal = document.getElementById('cpu-animal');
  const cRibbon = document.getElementById('cpu-ribbon');
  const cJunk = document.getElementById('cpu-junk');

  if (!container) throw new Error('game-container element not found');

  const eventBus = EventBus.getInstance();
  const game = new Game(container);

  // Status message handler
  eventBus.on('STATUS_MESSAGE', (msg: string) => {
    if (statusBanner) statusBanner.innerText = msg;
  });

  // Captured cards update
  eventBus.on('CARD_CAPTURED', ({ playerId, captured, total }: { playerId: 'player' | 'cpu'; captured: CardDef[]; total: CardDef[] }) => {
    const gwangCount = total.filter((c) => c.category === 'gwang').length;
    const animalCount = total.filter((c) => c.category === 'animal').length;
    const ribbonCount = total.filter((c) => c.category === 'ribbon').length;
    const junkCount = total.filter((c) => c.category === 'junk').length;
    const score = calculateScore(total);
    if (captureNotice && playerId === 'player') {
      const breakdown = calculateScoreBreakdown(total);
      const reason = breakdown.reasons.length > 0 ? breakdown.reasons.join(' · ') : '아직 점수 조건을 충족하지 않았습니다.';
      captureNotice.innerHTML = `<strong>획득 ${captured.length}장 · 현재 ${score}점</strong> <span>${reason}</span> ${captured.map((card) => `<img src="${AssetManager.getInstance().getCardImageUrl(card)}" alt="${card.name}">`).join('')}`;
      captureNotice.classList.add('visible');
      window.setTimeout(() => captureNotice.classList.remove('visible'), 2400);
    }

    if (playerId === 'player') {
      if (pGwang) pGwang.innerText = gwangCount.toString();
      if (pAnimal) pAnimal.innerText = animalCount.toString();
      if (pRibbon) pRibbon.innerText = ribbonCount.toString();
      if (pJunk) pJunk.innerText = junkCount.toString();
      if (playerScore) playerScore.innerText = score.toString();
    } else {
      if (cGwang) cGwang.innerText = gwangCount.toString();
      if (cAnimal) cAnimal.innerText = animalCount.toString();
      if (cRibbon) cRibbon.innerText = ribbonCount.toString();
      if (cJunk) cJunk.innerText = junkCount.toString();
      if (cpuScore) cpuScore.innerText = score.toString();
    }
  });

  eventBus.on('TURN_CHANGED', ({ currentTurn }: { currentTurn: 'player' | 'cpu' }) => {
    if (statusBanner) statusBanner.innerText = currentTurn === 'player' ? '내 차례 · 카드를 한 번 눌러 선택하세요' : '상대가 카드를 고르는 중입니다…';
  });

  // Reset captured UI counts on new game
  eventBus.on('GAME_STARTED', () => {
    if (btnRestart) btnRestart.style.display = 'none';
    if (pGwang) pGwang.innerText = '0';
    if (pAnimal) pAnimal.innerText = '0';
    if (pRibbon) pRibbon.innerText = '0';
    if (pJunk) pJunk.innerText = '0';

    if (cGwang) cGwang.innerText = '0';
    if (cAnimal) cAnimal.innerText = '0';
    if (cRibbon) cRibbon.innerText = '0';
    if (cJunk) cJunk.innerText = '0';
  });

  // Choice modal when 2 matching cards on floor
  eventBus.on('CHOICE_REQUIRED', ({ candidates }: { card: CardDef; candidates: CardDef[] }) => {
    if (!choiceModal || !choiceCardsContainer) return;

    choiceCardsContainer.innerHTML = '';
    candidates.forEach((cand) => {
      const item = document.createElement('div');
      item.className = 'choice-card-item';
      item.innerHTML = `
        <div style="font-size: 28px;">🎴</div>
        <div class="choice-card-name">${cand.name}</div>
      `;
      item.onclick = () => {
        choiceModal.style.display = 'none';
        game.resolveUserChoice(cand);
      };
      item.querySelector('div[style]')?.remove();
      const image = document.createElement('img');
      image.className = 'choice-card-image';
      image.src = AssetManager.getInstance().getCardImageUrl(cand);
      image.alt = cand.name;
      item.prepend(image);
      choiceCardsContainer.appendChild(item);
    });

    choiceModal.style.display = 'flex';
  });

  eventBus.on('CHOICE_RESOLVED', () => {
    if (choiceModal) choiceModal.style.display = 'none';
  });

  eventBus.on('GO_STOP_REQUIRED', ({ score, goCount }: { score: number; goCount: number }) => {
    const scoreLabel = document.getElementById('go-stop-score');
    if (scoreLabel) scoreLabel.innerText = `${score}점 · ${goCount} GO`;
    if (goStopModal) goStopModal.style.display = 'flex';
  });

  eventBus.on('GAME_OVER', ({ playerScore, cpuScore }: { playerScore?: number; cpuScore?: number }) => {
    if (goStopModal) goStopModal.style.display = 'none';
    if (statusBanner) statusBanner.innerText = `게임 종료 · 나 ${playerScore ?? 0}점 / CPU ${cpuScore ?? 0}점`;
  });

  eventBus.on('GAME_OVER', ({ message, playerScore, cpuScore }: { message?: string; playerScore?: number; cpuScore?: number }) => {
    if (goStopModal) goStopModal.style.display = 'none';
    const resultMessage = document.getElementById('result-message');
    const resultScores = document.getElementById('result-scores');
    if (resultMessage) resultMessage.innerText = message ?? '게임이 종료되었습니다.';
    if (resultScores) resultScores.innerText = `나 ${playerScore ?? 0}점 · CPU ${cpuScore ?? 0}점`;
    if (resultModal) resultModal.style.display = 'flex';
  });

  btnGo?.addEventListener('click', () => {
    if (goStopModal) goStopModal.style.display = 'none';
    void game.resolveGoStop('go');
  });
  btnStop?.addEventListener('click', () => {
    if (goStopModal) goStopModal.style.display = 'none';
    void game.resolveGoStop('stop');
  });
  document.getElementById('btn-result-restart')?.addEventListener('click', () => {
    if (resultModal) resultModal.style.display = 'none';
    void game.startNewRound();
  });

  // Restart Button
  btnRestart?.addEventListener('click', () => {
    game.startNewRound();
  });

  try {
    await game.start();

    // Hide loading screen
    if (loadingScreen) {
      loadingScreen.style.opacity = '0';
      setTimeout(() => {
        loadingScreen.style.display = 'none';
      }, 400);
    }
  } catch (err) {
    console.error('Failed to initialize game:', err);
    if (loadingScreen) {
      loadingScreen.innerHTML = `<p style="color: #ef4444;">초기화 실패: ${(err as Error).message}</p>`;
    }
  }
}

window.addEventListener('DOMContentLoaded', bootstrap);
