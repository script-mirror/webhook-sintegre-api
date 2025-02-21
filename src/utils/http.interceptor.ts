import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { HttpService } from '@nestjs/axios';

@Injectable()
export class HttpRequestBodyInterceptor implements NestInterceptor {
  constructor(private readonly httpService: HttpService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const requestId =
      request.headers["x-request-id"] || request.id;

    if (requestId) {
      this.httpService.axiosRef.defaults.headers.common['x-request-id'] =
        requestId;
    }

    return next.handle();
  }
}
