import { Controller, Post, Delete, Param, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DevicesService } from './devices.service';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('devices')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@Controller('devices')
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Post()
  @ApiOperation({ summary: 'Register a device for push notifications' })
  registerDevice(@Body() dto: RegisterDeviceDto, @Req() req: any) {
    return this.devicesService.registerDevice(req.user.id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove a device' })
  removeDevice(@Param('id') id: string, @Req() req: any) {
    return this.devicesService.removeDevice(req.user.id, id);
  }
}
