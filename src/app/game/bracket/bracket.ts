import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TournamentService } from '../tournament';
import { TournamentBracket, Girl } from '../models';

@Component({
  selector: 'app-bracket',
  imports: [CommonModule],
  templateUrl: './bracket.html',
  styleUrl: './bracket.scss'
})
export class BracketComponent implements OnInit {
  brackets: TournamentBracket[] = [];
  girls: Girl[] = [];

  constructor(public tournamentService: TournamentService) {}

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.brackets = this.tournamentService.getTournamentBrackets();
    this.girls = this.tournamentService.getGirls();
  }

  createBracket() {
    const allGirls = this.girls.map(g => g.id);
    if (allGirls.length >= 2) {
      this.tournamentService.createTournamentBracket(allGirls);
      this.loadData();
    }
  }
}