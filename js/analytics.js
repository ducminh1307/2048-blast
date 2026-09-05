/**
 * Playtest Analytics & Metrics Tracker
 * Based on GDD v0.1 Section 31 & Section 32
 */

class AnalyticsTracker {
  constructor() {
    this.reset();
  }

  reset() {
    this.turns = 0;
    this.score = 0;
    this.historyOccupancy = [];
    this.peakOccupancy = 0;

    this.mergeCount = 0;
    this.pairMergeCount = 0;
    this.tripleMergeCount = 0;
    this.quadPlusMergeCount = 0;

    this.chainCount = 0;
    this.maxChainLength = 0;

    this.emptyCellsPlaced = 0;
    this.invalidDropAttempts = 0;

    this.totalSpaceRecovered = 0;
    this.traysWithoutMerge = 0;
    this.gameOverEmptyCells = 0;

    this.listeners = [];
  }

  onChange(fn) {
    this.listeners.push(fn);
  }

  notify() {
    this.listeners.forEach(fn => fn(this.getMetrics()));
  }

  recordTurn(emptyCellsPlaced, currentOccupancyRatio) {
    this.turns++;
    this.emptyCellsPlaced += emptyCellsPlaced;

    const occPercent = Math.round(currentOccupancyRatio * 100);
    this.historyOccupancy.push(occPercent);
    if (occPercent > this.peakOccupancy) {
      this.peakOccupancy = occPercent;
    }
    this.notify();
  }

  recordMerge(count, value, chainLevel) {
    this.mergeCount++;
    if (count === 2) this.pairMergeCount++;
    else if (count === 3) this.tripleMergeCount++;
    else if (count >= 4) this.quadPlusMergeCount++;

    const spaceRecovered = count - 1;
    this.totalSpaceRecovered += spaceRecovered;

    if (chainLevel > 1) {
      this.chainCount++;
      if (chainLevel > this.maxChainLength) {
        this.maxChainLength = chainLevel;
      }
    }
    this.notify();
  }

  recordInvalidDrop() {
    this.invalidDropAttempts++;
    this.notify();
  }

  recordScore(score) {
    this.score = score;
    this.notify();
  }

  recordGameOver(remainingEmptyCells) {
    this.gameOverEmptyCells = remainingEmptyCells;
    this.notify();
  }

  getMetrics() {
    const totalPlaced = this.emptyCellsPlaced;
    const mergeRate = this.turns > 0 ? (this.mergeCount / this.turns).toFixed(2) : '0.00';
    const avgOccupancy = this.historyOccupancy.length > 0
      ? (this.historyOccupancy.reduce((a, b) => a + b, 0) / this.historyOccupancy.length).toFixed(1)
      : '0.0';
    const currentOccupancy = this.historyOccupancy.length > 0
      ? this.historyOccupancy[this.historyOccupancy.length - 1]
      : 0;
    const avgSpaceRecovered = this.mergeCount > 0
      ? (this.totalSpaceRecovered / this.mergeCount).toFixed(2)
      : '0.00';

    return {
      turns: this.turns,
      score: this.score,
      currentOccupancy: `${currentOccupancy}%`,
      avgOccupancy: `${avgOccupancy}%`,
      peakOccupancy: `${this.peakOccupancy}%`,
      mergeCount: this.mergeCount,
      pairMergeCount: this.pairMergeCount,
      tripleMergeCount: this.tripleMergeCount,
      quadPlusMergeCount: this.quadPlusMergeCount,
      chainCount: this.chainCount,
      maxChainLength: this.maxChainLength,
      emptyCellsPlaced: this.emptyCellsPlaced,
      totalPlaced: totalPlaced,
      mergeRate: mergeRate,
      totalSpaceRecovered: this.totalSpaceRecovered,
      avgSpaceRecovered: avgSpaceRecovered,
      invalidDrops: this.invalidDropAttempts,
      gameOverEmptyCells: this.gameOverEmptyCells
    };
  }
}

window.analyticsTracker = new AnalyticsTracker();
