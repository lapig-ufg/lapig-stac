import { Routes } from '@angular/router';

export default [
    {
        path: '',
        loadComponent: () => import('./item-detail.component').then((c) => c.ItemDetailComponent)
    }
] as Routes;
