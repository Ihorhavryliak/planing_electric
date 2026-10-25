import { Injectable } from '@nestjs/common';
import { Subject, type Observable } from 'rxjs';

export interface PlanEvent {
  planId: string;
  version: number;
  kind: string;
  at: string;
}

@Injectable()
export class RealtimeService {
  private readonly channels = new Map<string, Subject<PlanEvent>>();

  private channel(planId: string): Subject<PlanEvent> {
    let subject = this.channels.get(planId);
    if (!subject) {
      subject = new Subject<PlanEvent>();
      this.channels.set(planId, subject);
    }
    return subject;
  }

  emit(event: Omit<PlanEvent, 'at'>): void {
    this.channel(event.planId).next({ ...event, at: new Date().toISOString() });
  }

  stream(planId: string): Observable<PlanEvent> {
    return this.channel(planId).asObservable();
  }
}