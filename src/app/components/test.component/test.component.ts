import { Component, OnInit } from '@angular/core';
import { DatabaseService } from '../../services/db.service';

@Component({
  selector: 'app-test',
  templateUrl: './test.component.html',
  styleUrls: [ './test.component.scss' ]
})

export class TestComponent implements OnInit {
  
  constructor(private db: DatabaseService) {}

  ngOnInit(): void { 
      console.log('test comp init');
      this.db.getAllEvents().then((success) => {
          console.log('got events');
          console.log(success);
      })
  }

}
