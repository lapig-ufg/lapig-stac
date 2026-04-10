import { Routes } from '@angular/router';

export default [
    {
        path: '',
        loadComponent: () => import('./catalog.component').then((c) => c.CatalogComponent)
    }
] as Routes;
