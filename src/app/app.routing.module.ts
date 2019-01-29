import { NgModule }             from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { DashboardComponent }   from './components/dashboard/dashboard.component';
import { ThemeComponent }       from './components/themes/themes.component';
import { MusicMapComponent }    from './components/music-map/music-map.component';
import { PersonOrganizationComponent } from './components/personorganization/personorganization.component';
import { TestComponent } from './components/test.component/test.component';

const routes: Routes = [
  { path: 'dashboard', component: DashboardComponent },
  { path: 'music-map', component: MusicMapComponent },
  { path: 'people', component: PersonOrganizationComponent },
  { path: 'themes', component: ThemeComponent },
  { path: 'test', component: TestComponent },
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
  { path: '**', redirectTo: '/dashboard'},
];

@NgModule({
  imports: [ RouterModule.forRoot(routes) ],
  exports: [ RouterModule ]
})
export class AppRoutingModule {

}
