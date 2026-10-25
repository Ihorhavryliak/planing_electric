import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  createDimensionSchema,
  createPointSchema,
  createRoomSchema,
  createRouteSchema,
  createWallSchema,
  setCalibrationSchema,
  updateDimensionSchema,
  updatePointSchema,
  updateRoomSchema,
  updateRouteSchema,
  updateWallSchema,
  type CreateDimensionInput,
  type CreatePointInput,
  type CreateRoomInput,
  type CreateRouteInput,
  type CreateWallInput,
  type PlanCalculation,
  type PlanDrawing,
  type PublicCalibration,
  type PublicDimension,
  type PublicPoint,
  type PublicRoom,
  type PublicRoute,
  type PublicUser,
  type PublicWall,
  type SetCalibrationInput,
  type UpdateDimensionInput,
  type UpdatePointInput,
  type UpdateRoomInput,
  type UpdateRouteInput,
  type UpdateWallInput,
} from '@drawmyplace/contracts';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { DrawingService } from './drawing.service';

const uuid = () => new ParseUUIDPipe({ version: '4' });

@Controller()
@UseGuards(AuthGuard)
export class DrawingController {
  constructor(@Inject(DrawingService) private readonly drawing: DrawingService) {}

  @Get('plans/:planId/drawing')
  getDrawing(
    @CurrentUser() user: PublicUser,
    @Param('planId', uuid()) planId: string,
  ): Promise<PlanDrawing> {
    return this.drawing.getDrawing(user.id, planId);
  }

  @Get('plans/:planId/calculation')
  calculate(
    @CurrentUser() user: PublicUser,
    @Param('planId', uuid()) planId: string,
  ): Promise<PlanCalculation> {
    return this.drawing.calculate(user.id, planId);
  }

  // ------------------------------------------------------------ calibration

  @Put('plans/:planId/calibration')
  setCalibration(
    @CurrentUser() user: PublicUser,
    @Param('planId', uuid()) planId: string,
    @Body(new ZodValidationPipe(setCalibrationSchema))
    input: SetCalibrationInput,
  ): Promise<PublicCalibration> {
    return this.drawing.setCalibration(user.id, planId, input);
  }

  @Delete('plans/:planId/calibration')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteCalibration(
    @CurrentUser() user: PublicUser,
    @Param('planId', uuid()) planId: string,
  ): Promise<void> {
    return this.drawing.deleteCalibration(user.id, planId);
  }

  // ------------------------------------------------------------------ walls

  @Post('plans/:planId/walls')
  createWall(
    @CurrentUser() user: PublicUser,
    @Param('planId', uuid()) planId: string,
    @Body(new ZodValidationPipe(createWallSchema)) input: CreateWallInput,
  ): Promise<PublicWall> {
    return this.drawing.createWall(user.id, planId, input);
  }

  @Patch('walls/:wallId')
  updateWall(
    @CurrentUser() user: PublicUser,
    @Param('wallId', uuid()) wallId: string,
    @Body(new ZodValidationPipe(updateWallSchema)) input: UpdateWallInput,
  ): Promise<PublicWall> {
    return this.drawing.updateWall(user.id, wallId, input);
  }

  @Delete('walls/:wallId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteWall(
    @CurrentUser() user: PublicUser,
    @Param('wallId', uuid()) wallId: string,
  ): Promise<void> {
    return this.drawing.deleteWall(user.id, wallId);
  }

  // ------------------------------------------------------------------ rooms

  @Post('plans/:planId/rooms')
  createRoom(
    @CurrentUser() user: PublicUser,
    @Param('planId', uuid()) planId: string,
    @Body(new ZodValidationPipe(createRoomSchema)) input: CreateRoomInput,
  ): Promise<PublicRoom> {
    return this.drawing.createRoom(user.id, planId, input);
  }

  @Patch('rooms/:roomId')
  updateRoom(
    @CurrentUser() user: PublicUser,
    @Param('roomId', uuid()) roomId: string,
    @Body(new ZodValidationPipe(updateRoomSchema)) input: UpdateRoomInput,
  ): Promise<PublicRoom> {
    return this.drawing.updateRoom(user.id, roomId, input);
  }

  @Delete('rooms/:roomId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteRoom(
    @CurrentUser() user: PublicUser,
    @Param('roomId', uuid()) roomId: string,
  ): Promise<void> {
    return this.drawing.deleteRoom(user.id, roomId);
  }

  // ------------------------------------------------------------- dimensions

  @Post('plans/:planId/dimensions')
  createDimension(
    @CurrentUser() user: PublicUser,
    @Param('planId', uuid()) planId: string,
    @Body(new ZodValidationPipe(createDimensionSchema))
    input: CreateDimensionInput,
  ): Promise<PublicDimension> {
    return this.drawing.createDimension(user.id, planId, input);
  }

  @Patch('dimensions/:dimensionId')
  updateDimension(
    @CurrentUser() user: PublicUser,
    @Param('dimensionId', uuid()) dimensionId: string,
    @Body(new ZodValidationPipe(updateDimensionSchema))
    input: UpdateDimensionInput,
  ): Promise<PublicDimension> {
    return this.drawing.updateDimension(user.id, dimensionId, input);
  }

  @Delete('dimensions/:dimensionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteDimension(
    @CurrentUser() user: PublicUser,
    @Param('dimensionId', uuid()) dimensionId: string,
  ): Promise<void> {
    return this.drawing.deleteDimension(user.id, dimensionId);
  }

  // ----------------------------------------------------------------- points

  @Post('plans/:planId/points')
  createPoint(
    @CurrentUser() user: PublicUser,
    @Param('planId', uuid()) planId: string,
    @Body(new ZodValidationPipe(createPointSchema)) input: CreatePointInput,
  ): Promise<PublicPoint> {
    return this.drawing.createPoint(user.id, planId, input);
  }

  @Patch('points/:pointId')
  updatePoint(
    @CurrentUser() user: PublicUser,
    @Param('pointId', uuid()) pointId: string,
    @Body(new ZodValidationPipe(updatePointSchema)) input: UpdatePointInput,
  ): Promise<PublicPoint> {
    return this.drawing.updatePoint(user.id, pointId, input);
  }

  @Delete('points/:pointId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deletePoint(
    @CurrentUser() user: PublicUser,
    @Param('pointId', uuid()) pointId: string,
  ): Promise<void> {
    return this.drawing.deletePoint(user.id, pointId);
  }

  // ----------------------------------------------------------------- routes

  @Post('plans/:planId/routes')
  createRoute(
    @CurrentUser() user: PublicUser,
    @Param('planId', uuid()) planId: string,
    @Body(new ZodValidationPipe(createRouteSchema)) input: CreateRouteInput,
  ): Promise<PublicRoute> {
    return this.drawing.createRoute(user.id, planId, input);
  }

  @Patch('routes/:routeId')
  updateRoute(
    @CurrentUser() user: PublicUser,
    @Param('routeId', uuid()) routeId: string,
    @Body(new ZodValidationPipe(updateRouteSchema)) input: UpdateRouteInput,
  ): Promise<PublicRoute> {
    return this.drawing.updateRoute(user.id, routeId, input);
  }

  @Delete('routes/:routeId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteRoute(
    @CurrentUser() user: PublicUser,
    @Param('routeId', uuid()) routeId: string,
  ): Promise<void> {
    return this.drawing.deleteRoute(user.id, routeId);
  }
}
