import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-editor',
  templateUrl: './editor.page.html',
  styleUrls: ['./editor.page.scss'],
})
export class EditorPage implements OnInit {
  currentView: 'results' | '3D' = 'results';

  constructor(private route: ActivatedRoute) {}

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      if (params['view'] === '3D') {
        this.currentView = '3D';
      } else {
        this.currentView = 'results';
      }
    });
  }

  setView(view: 'results' | '3D') {
    this.currentView = view;
  }
}
