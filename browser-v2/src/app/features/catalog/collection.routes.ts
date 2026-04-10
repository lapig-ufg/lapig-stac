import { Routes } from '@angular/router';

export default [
    {
        path: '',
        loadComponent: () => import('./collection-detail.component').then((c) => c.CollectionDetailComponent)
    }
] as Routes;
