import { Routes } from '@angular/router';

export default [
    {
        path: '',
        loadComponent: () => import('./search.component').then((c) => c.SearchComponent)
    }
] as Routes;
