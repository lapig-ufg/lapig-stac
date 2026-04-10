import { Routes } from '@angular/router';
import { AppLayout } from '@/app/layout/components/app.layout';
import { Notfound } from '@/app/pages/notfound/notfound';

export const appRoutes: Routes = [
    {
        path: '',
        component: AppLayout,
        children: [
            {
                path: '',
                redirectTo: 'catalog',
                pathMatch: 'full'
            },
            {
                path: 'catalog',
                loadChildren: () => import('@/app/features/catalog/catalog.routes'),
                data: { breadcrumb: 'Catálogo' }
            },
            {
                path: 'collections/:collectionId',
                loadChildren: () => import('@/app/features/catalog/collection.routes'),
                data: { breadcrumb: 'Coleção' }
            },
            {
                path: 'collections/:collectionId/items/:itemId',
                loadChildren: () => import('@/app/features/item/item.routes'),
                data: { breadcrumb: 'Item' }
            },
            {
                path: 'search',
                loadChildren: () => import('@/app/features/search/search.routes'),
                data: { breadcrumb: 'Busca' }
            }
        ]
    },
    { path: 'notfound', component: Notfound },
    { path: '**', redirectTo: '/notfound' }
];
