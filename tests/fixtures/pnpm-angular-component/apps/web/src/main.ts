import { Component, Injectable, inject, signal, provideZonelessChangeDetection } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { RouterLink, RouterOutlet, provideRouter } from '@angular/router';
import { invoiceTotal } from './invoice.mjs';

@Injectable({ providedIn: 'root' })
class InvoiceState {
  total = signal(invoiceTotal([{ price: 17, quantity: 3 }, { price: 8, quantity: 0 }, { price: 11, quantity: 2 }]));
  add() { this.total.update(value => value + 8); }
}
@Component({ selector: 'invoice-orders', template: '<h2>Orders total: {{ state.total() }}</h2>' })
class Orders { state = inject(InvoiceState); }
@Component({ selector: 'invoice-home', template: '<h2>Invoice ready</h2>' })
class Home {}
@Component({ selector: 'invoice-app', imports: [RouterLink, RouterOutlet], template: '<main><h1>Angular component total: {{ state.total() }}</h1><button (click)="state.add()">Add item</button><a routerLink="/orders">Open orders</a><router-outlet /></main>' })
class App { state = inject(InvoiceState); }
bootstrapApplication(App, { providers: [provideZonelessChangeDetection(), provideRouter([{ path: 'orders', component: Orders }, { path: '', component: Home }])] }).catch(error => { throw error; });
