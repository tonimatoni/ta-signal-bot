import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { InputService } from './services/input/input.service';
import { TfAggregatorService } from './services/tf-aggregator/tf-aggregator.service';
import { SigGeneratorService } from './services/sig-generator/sig-generator.service';
import { EntryService } from './services/entry/entry.service';
import { CommandModule } from 'nestjs-command';
import { MacdStochRsiCommand } from './commands/macd-stoch-rsi.command';
import { ConfigService } from './services/config/config.service';
import { TaService } from './services/ta/ta.service';
import { MacdStochRsiService } from './services/sig-generator/strategies/macd-stoch-rsi/macd-stoch-rsi.service';

@Module({
  imports: [CommandModule],
  controllers: [AppController],
    providers: [AppService, InputService, TfAggregatorService, SigGeneratorService, EntryService,
    
        MacdStochRsiCommand,
    
        ConfigService,
    
        TaService,
    
        MacdStochRsiService
    ],
})
export class AppModule {}
