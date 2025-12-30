import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { WarehouseConfig } from 'src/app/models/warehouse.models';

@Injectable({
  providedIn: 'root'
})
export class WarehouseService {
  private apiUrl = 'http://localhost:5000/api';

  constructor(private http: HttpClient) { }

  createWarehouse(config: WarehouseConfig): Observable<any> {
    return this.http.post(`${this.apiUrl}/warehouse/create`, config)
      .pipe(
        catchError(this.handleError)
      );
  }

  validateConfig(config: WarehouseConfig): Observable<any> {
    return this.http.post(`${this.apiUrl}/warehouse/validate`, config)
      .pipe(
        catchError(this.handleError)
      );
  }

  getWarehouse(id: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/warehouse/${id}`)
      .pipe(
        catchError(this.handleError)
      );
  }

  deleteWarehouse(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/warehouse/${id}/delete`)
      .pipe(
        catchError(this.handleError)
      );
  }

  getWarehouseFromDb(warehouseId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/warehouse/db/${warehouseId}`)
      .pipe(
        catchError(this.handleError)
      );
  }

  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'An unknown error occurred!';
    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Error: ${error.error.message}`;
    } else {
      // Server-side error
      errorMessage = `Error Code: ${error.status}\nMessage: ${error.message}`;
      if (error.error?.detail) {
        errorMessage = error.error.detail;
      }
    }
    console.error(errorMessage);
    return throwError(() => new Error(errorMessage));
  }

  
}